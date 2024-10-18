/*
	PixPal

	Copyright (c) 2024 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const SequentialReadBuffer = require( 'stream-kit/lib/SequentialReadBuffer.js' ) ;
const SequentialWriteBuffer = require( 'stream-kit/lib/SequentialWriteBuffer.js' ) ;


// Includes depending on the environment
var DecompressionStream = null ;
var CompressionStream = null ;
var loadFileAsync = null ;
var saveFileAsync = null ;
var download = null ;

if ( process.browser ) {
	DecompressionStream = window.DecompressionStream ;
	CompressionStream = window.CompressionStream ;
	loadFileAsync = async ( url ) => {
		var response = await fetch( url ) ;
		if ( ! response.ok ) {
			throw new Error( "Can't retrieve file: '" + url + "', " + response.status + " - " + response.statusText ) ;
		}
		var bytes = await response.bytes() ;
		var buffer = Buffer.from( bytes ) ;
		return buffer ;
	} ;
	saveFileAsync = () => { throw new Error( "Can't save from browser (use .download() instead)" ) ; } ;
	download = ( filename , buffer ) => {
		var anchor = window.document.createElement( 'a' ) ;
		anchor.href = window.URL.createObjectURL( new Blob( [ buffer ] , { type: 'application/octet-stream' } ) ) ;
		anchor.download = filename ;

		// Force a click to start downloading, even if the anchor is not even appended to the body
		anchor.click() ;
	} ;
}
else {
	let require_ = require ;	// this is used to fool Browserfify, so it doesn't try to include this in the build
	( { DecompressionStream , CompressionStream } = require_( 'stream/web' ) ) ;
	let fs = require_( 'fs' ) ;
	loadFileAsync = url => fs.promises.readFile( url ) ;
	saveFileAsync = ( url , data ) => fs.promises.writeFile( url , data ) ;
	download = () => { throw new Error( "Can't download from non-browser (use .saveFileAsync() instead)" ) ; } ;
}



function JsGFF( params = {} ) {
	this.formatCodeName = params.formatCodeName || 'generic' ;
	this.magicNumbers = Buffer.from( 'JSGFF/' + this.formatCodeName + '\n' , 'latin1' ) ;
	this.debug = !! params.debug ;
}

module.exports = JsGFF ;

JsGFF.stringifyMeta = require( './stringifyMeta.js' ) ;
JsGFF.parseMeta = require( './parseMeta.js' ) ;



JsGFF.prototype.createFileData = function( headers = {} ) {
	return new FileData( this , headers ) ;
} ;



function FileData( jsGFF , headers = {} ) {
	this.jsGFF = jsGFF ;
	this.headers = headers ;
	this.contents = {} ;
} ;

JsGFF.FileData = FileData ;



FileData.prototype.addContent = function( type , content ) {
	if ( ! this.contents[ type ] ) { this.contents[ type ] = [ content ] ; }
	else { this.contents[ type ].push( content ) ; }
} ;



FileData.prototype.save = async function( url ) {
	var buffer = await this.encode() ;
	await saveFileAsync( url , buffer ) ;
} ;



FileData.prototype.download = async function( filename ) {
	var buffer = await this.encode() ;
	await download( filename , buffer ) ;
} ;



FileData.prototype.load = async function( url ) {
	var buffer = await loadFileAsync( url ) ;
	return this.decode( buffer ) ;
} ;



// Content format
JsGFF.CFORMAT_BUFFER = 1 ;
JsGFF.CFORMAT_STRING = 2 ;
JsGFF.CFORMAT_OBJECT = 3 ;



FileData.prototype.encode = async function() {
	var writableBuffer = new SequentialWriteBuffer() ;

	// Write the magic numbers
	writableBuffer.writeBuffer( this.jsGFF.magicNumbers ) ;
	
	// Write the headers
	var headers = JsGFF.stringifyMeta( this.headers ) ;
	writableBuffer.writeNullTerminatedUtf8( JsGFF.stringifyMeta( this.headers ) ) ;
	
	// Write all content chunks
	for ( let contentType of Object.keys( this.contents ) ) {
		let contents = this.contents[ contentType ] ;
		for ( let content of contents ) {
			writableBuffer.writeLps8Utf8( contentType ) ;

			if ( content instanceof Buffer ) {
				writableBuffer.writeUInt8( JsGFF.CFORMAT_BUFFER ) ;
				writableBuffer.writeUInt32( content.length ) ;
				writableBuffer.writeBuffer( content ) ;
			}
			else if ( typeof content === 'string' ) {
				writableBuffer.writeUInt8( JsGFF.CFORMAT_STRING ) ;
				writableBuffer.writeLps32Utf8( content ) ;
			}
			else if ( content && typeof content === 'object' ) {
				writableBuffer.writeUInt8( JsGFF.CFORMAT_OBJECT ) ;
				writableBuffer.writeLps32Utf8( JsGFF.stringifyMeta( content ) ) ;
			}
		}
	}

	return writableBuffer.getBuffer( true ) ;
} ;



FileData.prototype.decode = async function( buffer ) {
	var readableBuffer = new SequentialReadBuffer( buffer ) ;
	
	// Magic numbers
	for ( let i = 0 ; i < this.jsGFF.magicNumbers.length ; i ++ ) {
		if ( this.jsGFF.magicNumbers[ i ] !== readableBuffer.readUInt8() ) {
			throw new Error( "Not a JsGFF/" + this.jsGFF.formatCodeName + " file, it doesn't start with the correct magic numbers" ) ;
		}
	}

	// Read the headers
	this.headers = JsGFF.parseMeta( readableBuffer.readNullTerminatedUtf8() ) ;
	console.log( "ptr: 0x" + readableBuffer.ptr.toString( 16 ) ) ;


	// Read all content chunks
	while ( ! readableBuffer.ended ) {
		let contentType = readableBuffer.readLps8Utf8() ;
		console.log( "contentType: '" + contentType + "'" , contentType.length ) ;
		let contentFormat = readableBuffer.readUInt8() ;
		console.log( "contentFormat:" , contentFormat ) ;
		let content ;

		switch ( contentFormat ) {
			case JsGFF.CFORMAT_BUFFER : {
				let contentSize = readableBuffer.readUInt32() ;
				content = readableBuffer.readBuffer( contentSize ) ;
				break ;
			}
			case JsGFF.CFORMAT_STRING : {
				content = readableBuffer.readLps32Utf8() ;
				break ;
			}
			case JsGFF.CFORMAT_OBJECT : {
				content = JsGFF.parseMeta( readableBuffer.readLps32Utf8() ) ;
				break ;
			}
		}

		if ( ! this.contents[ contentType ] ) { this.contents[ contentType ] = [ content ] ; }
		else { this.contents[ contentType ].push( content ) ; }
	}
} ;







JsGFF.prototype.decode = async function( buffer , options = {} ) {
	var readableBuffer = new SequentialReadBuffer( buffer ) ;
	
	// Magic numbers
	for ( let i = 0 ; i < PNG_MAGIC_NUMBERS.length ; i ++ ) {
		if ( PNG_MAGIC_NUMBERS[ i ] !== readableBuffer.readUInt8() ) {
			throw new Error( "Not a PNG, it doesn't start with PNG magic numbers" ) ;
		}
	}

	this.palette.length = 0 ;
	this.imageBuffer = null ;

	// Chunk reading
	while ( ! readableBuffer.ended ) {
		if ( this.iendReceived ) {
			throw new Error( "Bad PNG, chunk after IEND" ) ;
		}

		let chunkSize = readableBuffer.readUInt32BE() ;
		let chunkType = readableBuffer.readUtf8( 4 ) ;
		//let chunkType = readableBuffer.readString( 4 , 'latin1' ) ;

		console.log( "Found chunk: '" + chunkType + "' of size: " + chunkSize ) ;

		if ( chunkDecoders[ chunkType ] ) {
			let chunkBuffer = readableBuffer.readBuffer( chunkSize , true ) ;
			let chunkCrc32 = readableBuffer.readInt32BE() ;

			if ( options.crc32 ) {
				let chunkComputedCrc32 = crc32.buf( chunkBuffer , crc32.bstr( chunkType ) ) ;
				if ( chunkComputedCrc32 !== chunkCrc32 ) {
					throw new Error( "Bad CRC-32 for chunk '" + chunkType + "', expecting: " + chunkCrc32 + " but got: " + chunkComputedCrc32  ) ;
				}
				//else { console.log( "  CRC-32 match: '" + chunkCrc32 + "' = '" + chunkComputedCrc32 + "'" ) ; }
			}

			chunkDecoders[ chunkType ].call( this , new SequentialReadBuffer( chunkBuffer ) , options ) ;
		}
		else {
			// Skip the chunk and its CRC
			readableBuffer.skip( chunkSize + 4 ) ;
		}
	}

	if ( ! this.iendReceived ) {
		throw new Error( "Bad PNG, no IEND chunk received" ) ;
	}

	await this.generateImageData() ;
} ;



JsGFF.prototype.addChunk = async function( chunks , chunkType , options ) {
	if ( ! chunkEncoders[ chunkType ] ) { return ; }

	var dataBuffer = await chunkEncoders[ chunkType ].call( this , options ) ;
	if ( ! dataBuffer ) { return ; }

	var chunkBuffer = this.generateChunkFromData( chunkType , dataBuffer ) ;
	chunks.push( chunkBuffer ) ;
} ;



JsGFF.prototype.generateChunkFromData = function( chunkType , dataBuffer ) {
	// 4 bytes for the data length | 4 bytes type (ascii) | chunk data (variable length) | 4 bytes of CRC-32 (type + data)
	var chunkBuffer = Buffer.alloc( CHUNK_META_SIZE + dataBuffer.length ) ;

	chunkBuffer.writeInt32BE( dataBuffer.length ) ;
	chunkBuffer.write( chunkType , 4 , 4 , 'latin1' ) ;
	dataBuffer.copy( chunkBuffer , 8 ) ;

	// Add the CRC-32, the 2nd argument of crc32.buf() is the seed, it's like building a CRC
	// of a single buffer containing chunkType + dataBuffer.
	var chunkComputedCrc32 = crc32.buf( dataBuffer , crc32.bstr( chunkType ) ) ;
	chunkBuffer.writeInt32BE( chunkComputedCrc32 , chunkBuffer.length - 4 ) ;
	console.log( "Generated chunk: '" + chunkType + "' of size: " + dataBuffer.length + " and CRC-32: " + chunkComputedCrc32 ) ;

	return chunkBuffer ;
} ;



async function inflate( buffer ) {
	const decompressionStream = new DecompressionStream( 'deflate' ) ;
	const blob = new Blob( [ buffer ] ) ;
	const stream = blob.stream().pipeThrough( decompressionStream ) ;
	//console.log( "Blob bytes:" , await blob.arrayBuffer() ) ;

	const chunks = [] ;
	for await ( let chunk of stream ) { chunks.push( chunk ) ; }

	// Buffer.concat() also accepts Uint8Array
	return Buffer.concat( chunks ) ;
}



async function deflate( buffer ) {
	const compressionStream = new CompressionStream( 'deflate' ) ;
	const blob = new Blob( [ buffer ] ) ;
	const stream = blob.stream().pipeThrough( compressionStream ) ;
	//console.log( "Blob bytes:" , await blob.arrayBuffer() ) ;

	const chunks = [] ;
	for await ( let chunk of stream ) { chunks.push( chunk ) ; }

	// Buffer.concat() also accepts Uint8Array
	return Buffer.concat( chunks ) ;
}

