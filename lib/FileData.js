/*
	JsGFF

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



const stringifyMeta = require( './stringifyMeta.js' ) ;
const parseMeta = require( './parseMeta.js' ) ;

const SequentialReadBuffer = require( 'stream-kit/lib/SequentialReadBuffer.js' ) ;
const SequentialWriteBuffer = require( 'stream-kit/lib/SequentialWriteBuffer.js' ) ;



/*
	The data associated with a file, about to be written, or after being read.
*/
function FileData( jsGFF , headers , metadata ) {
	this.jsGFF = jsGFF ;
	this.headers = {} ;
	this.metadata = {} ;
	this.contents = {} ;

	if ( headers ) { this.setHeaders( headers ) ; }
	if ( metadata ) { this.setMetadata( metadata ) ; }
}

module.exports = FileData ;



FileData.prototype.setHeaders = function( headers ) {
	if ( ! headers || typeof headers !== 'object' || Array.isArray( headers ) ) { return ; }
	this.headers = headers ;
} ;



FileData.prototype.setMetadata = function( metadata ) {
	if ( ! metadata || typeof metadata !== 'object' || Array.isArray( metadata ) ) { return ; }
	this.metadata = metadata ;
} ;



FileData.prototype.addContent = function( type , content , headers , flags ) {
	if ( ! this.contents[ type ] ) { this.contents[ type ] = [] ; }

	if ( ! headers || typeof headers !== 'object' || Array.isArray( headers ) ) { headers = {} ; }
	if ( ! flags || typeof flags !== 'object' || Array.isArray( flags ) ) { flags = {} ; }

	this.contents[ type ].push( { content , headers , flags } ) ;
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



/*
	Header:
	| variable       | variable               | 1 byte    | variable               |
	| Magic numbers  | null-terminated string | 0x0a "\n" | null-terminated string |
	| ending with \n | header                 |           | metadata               |


	Content chunks:
	| variable     | 1 byte    | variable               | 1 byte        | 4 bytes        | variable |
	| LPS8 string  | 0x0a "\n" | null-terminated string | content flags | content length | content  |
	| content type |           | content header         |               |                |          |

	Content flags:
	5 bits: reserved | 1 bit: deflate | 2 bits: format
*/

// Content format
FileData.CFORMAT_BUFFER = 0 ;
FileData.CFORMAT_STRING = 1 ;
FileData.CFORMAT_OBJECT = 2 ;

// Compression
FileData.COMPRESSION_NONE = 0 ;
FileData.COMPRESSION_DEFLATE = 4 ;



FileData.prototype.encode = async function() {
	var writableBuffer = new SequentialWriteBuffer() ;

	// Write the magic numbers
	writableBuffer.writeBuffer( this.jsGFF.magicNumbers ) ;

	// Write the headers
	writableBuffer.writeNullTerminatedUtf8( stringifyMeta( this.headers ) ) ;

	// Write the metadata
	writableBuffer.writeUInt8( 0x0a ) ;	// \n -> Ease text editor operations
	writableBuffer.writeNullTerminatedUtf8( stringifyMeta( this.metadata ) ) ;

	// Write all content chunks
	for ( let contentType of Object.keys( this.contents ) ) {
		let contents = this.contents[ contentType ] ;

		for ( let { content , headers , flags } of contents ) {
			let contentFormat = FileData.getContentFormat( content ) ;
			if ( contentFormat < 0 ) { continue ; }
			console.log( "contentType: '" + contentType + "' format: " , contentFormat ) ;

			let flagByte = contentFormat ;
			if ( flags.deflate ) { flagByte += FileData.COMPRESSION_DEFLATE ; }

			// Write the type of the content
			writableBuffer.writeLps8Utf8( contentType ) ;

			// Write the content headers
			writableBuffer.writeUInt8( 0x0a ) ;	// \n -> Ease text editor operations
			writableBuffer.writeNullTerminatedUtf8( stringifyMeta( headers ) ) ;

			// Write the flags
			console.log( "flagByte:" , flagByte ) ;
			writableBuffer.writeUInt8( flagByte ) ;

			// Write the size and the content
			switch ( contentFormat ) {
				case FileData.CFORMAT_BUFFER : {
					if ( flags.deflate ) {
						let compressedBuffer = await deflate( content ) ;
						writableBuffer.writeUInt32( compressedBuffer.length ) ;
						writableBuffer.writeBuffer( compressedBuffer ) ;
					}
					else {
						writableBuffer.writeUInt32( content.length ) ;
						writableBuffer.writeBuffer( content ) ;
					}

					break ;
				}
				case FileData.CFORMAT_STRING : {
					if ( flags.deflate ) {
						let compressedBuffer = await deflate( Buffer.from( content , 'utf8' ) ) ;
						writableBuffer.writeUInt32( compressedBuffer.length ) ;
						writableBuffer.writeBuffer( compressedBuffer ) ;
					}
					else {
						writableBuffer.writeLps32Utf8( content ) ;
					}

					break ;
				}
				case FileData.CFORMAT_OBJECT : {
					let stringified = stringifyMeta( content ) ;

					if ( flags.deflate ) {
						let compressedBuffer = await deflate( Buffer.from( stringified , 'utf8' ) ) ;
						writableBuffer.writeUInt32( compressedBuffer.length ) ;
						writableBuffer.writeBuffer( compressedBuffer ) ;
					}
					else {
						writableBuffer.writeLps32Utf8( stringified ) ;
					}

					break ;
				}
			}
		}
	}

	// Mark end of content
	writableBuffer.writeUInt8( 0 ) ;

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
	this.headers = parseMeta( readableBuffer.readNullTerminatedUtf8() ) ;

	// Read the metadata
	if ( readableBuffer.readUInt8() !== 0x0a ) { throw new Error( "Corrupted JsGFF (missing pre-metadata '\\n')" ) ; }
	this.metadata = parseMeta( readableBuffer.readNullTerminatedUtf8() ) ;

	console.log( "ptr: 0x" + readableBuffer.ptr.toString( 16 ) ) ;


	// Read all content chunks
	while ( ! readableBuffer.ended ) {
		// Read the type of content
		let contentType = readableBuffer.readLps8Utf8() ;

		if ( contentType === '' ) {
			// A null byte was received, this is the end of the content, and so the end of the file
			if ( ! readableBuffer.ended ) { throw new Error( "Corrupted JsGFF (expecting end of file)" ) ; }
			console.log( "End of file" ) ;
			return ;
		}

		console.log( "contentType: '" + contentType + "'" , contentType.length ) ;

		// Read the content headers
		if ( readableBuffer.readUInt8() !== 0x0a ) { throw new Error( "Corrupted JsGFF (missing pre-content-headers '\\n')" ) ; }
		let headers = parseMeta( readableBuffer.readNullTerminatedUtf8() ) ;

		// Read the flags
		let flagByte = readableBuffer.readUInt8() ;
		console.log( "flagByte:" , flagByte ) ;
		let flags = {} ;
		if ( flagByte & FileData.COMPRESSION_DEFLATE ) { flags.deflate = true ; }
		let contentFormat = flagByte & 0b11 ;
		console.log( "contentFormat:" , contentFormat ) ;

		// Read the size and the content
		let content ;

		switch ( contentFormat ) {
			case FileData.CFORMAT_BUFFER : {
				let contentSize = readableBuffer.readUInt32() ;
				content = readableBuffer.readBuffer( contentSize ) ;
				if ( flags.deflate ) { content = await inflate( content ) ; }
				break ;
			}
			case FileData.CFORMAT_STRING : {
				if ( flags.deflate ) {
					let contentSize = readableBuffer.readUInt32() ;
					let compressedBuffer = readableBuffer.readBuffer( contentSize ) ;
					let decompressedBuffer = await inflate( compressedBuffer ) ;
					content = decompressedBuffer.toString( 'utf8' ) ;
				}
				else {
					content = readableBuffer.readLps32Utf8() ;
				}

				break ;
			}
			case FileData.CFORMAT_OBJECT : {
				if ( flags.deflate ) {
					let contentSize = readableBuffer.readUInt32() ;
					let compressedBuffer = readableBuffer.readBuffer( contentSize ) ;
					let decompressedBuffer = await inflate( compressedBuffer ) ;
					content = decompressedBuffer.toString( 'utf8' ) ;
				}
				else {
					content = readableBuffer.readLps32Utf8() ;
				}

				content = parseMeta( content ) ;

				break ;
			}
		}

		if ( ! this.contents[ contentType ] ) { this.contents[ contentType ] = [] ; }
		this.contents[ contentType ].push( { content , headers , flags } ) ;
	}
} ;



FileData.getContentFormat = content =>
	content instanceof Buffer ? FileData.CFORMAT_BUFFER :
	typeof content === 'string' ? FileData.CFORMAT_STRING :
	content && typeof content === 'object' ? FileData.CFORMAT_OBJECT :
	- 1 ;



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

