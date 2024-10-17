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



JsGFF.prototype.createFileData = function( headers = {} ) {
	return new JsGFF.FileData( this , headers ) ;
} ;



function FileData( jsGFF , headers = {} ) {
	this.jsGFF = jsGFF ;
	this.headers = {} ;
	this.contents = {} ;
} ;

JsGFF.FileData = FileData ;



FileData.prototype.addContent = function( type , content ) {
	this.contents[ type ] = content ;
} ;



FileData.prototype.save = async function( url ) {
	var buffer = await this.encode() ;
	await saveFileAsync( url , buffer ) ;
} ;



FileData.prototype.load = async function( url ) {
	var buffer = await loadFileAsync( url ) ;
	return this.decode( buffer ) ;
} ;



FileData.prototype.encode = function() {
	var writableBuffer = new SequentialWriteBuffer() ;
	writableBuffer.writeBuffer( this.jsGFF.magicNumbers ) ;
	
	this.encodeHeader( writableBuffer ) ;

	return writableBuffer.getBuffer( true ) ;
} ;



FileData.prototype.encodeHeader = function( writableBuffer ) {
	for ( let key of Object.keys( this.headers ) ) {
		let value = this.headers[ key ] ;
		writableBuffer.writeString( key + ':' + value + '\n' ) ;
	}
} ;



FileData.prototype.decode = async function( buffer ) {
	var readableBuffer = new SequentialReadBuffer( buffer ) ;
	
	// Magic numbers
	for ( let i = 0 ; i < this.jsGFF.magicNumbers.length ; i ++ ) {
		if ( this.jsGFF.magicNumbers[ i ] !== readableBuffer.readUInt8() ) {
			throw new Error( "Not a JsGFF/" + this.jsGFF.formatCodeName + " file, it doesn't start with the correct magic numbers" ) ;
		}
	}
} ;



JsGFF.prototype.encode = async function( options = {} ) {
	var chunks = [] ;

	// Add magic numbers
	chunks.push( PNG_MAGIC_NUMBERS_BUFFER ) ;

	// IHDR: image header
	await this.addChunk( chunks , 'IHDR' , options ) ;

	// PLTE: the palette for indexed PNG
	await this.addChunk( chunks , 'PLTE' , options ) ;

	// tRNS: the color indexes for transparency
	await this.addChunk( chunks , 'tRNS' , options ) ;

	// bKGD: the default background color
	await this.addChunk( chunks , 'bKGD' , options ) ;

	// IDAT: the image pixel data
	await this.addChunk( chunks , 'IDAT' , options ) ;

	// Finalize by sending the IEND chunk to end the file
	chunks.push( IEND_CHUNK_BUFFER ) ;

	console.log( "Chunks:" , chunks ) ;
	return Buffer.concat( chunks ) ;
} ;












JsGFF.createEncoder = ( params = {} ) => {
	var png = new JsGFF() ;

	png.width = + params.width || 0 ;
	png.height = + params.height || 0 ;
	png.bitDepth = + params.bitDepth || 0 ;
	png.colorType = params.colorType ?? JsGFF.COLOR_TYPE_INDEXED ;

	png.compressionMethod = 0 ;
	png.filterMethod = 0 ;
	png.interlaceMethod = 0 ;	// unsupported

	if ( Array.isArray( params.palette ) ) { png.palette = params.palette ; }

	if ( params.imageBuffer && ( params.imageBuffer instanceof Buffer ) ) {
		png.imageBuffer = params.imageBuffer ;
	}

	if ( ! png.bitDepth ) {
		if ( png.colorType === JsGFF.COLOR_TYPE_INDEXED ) {
			let colors = png.palette.length ;
			png.bitDepth =
				colors <= 2 ? 1 :
				colors <= 4 ? 2 :
				colors <= 16 ? 4 :
				8 ;
		}
		else {
			png.bitDepth = 8 ;
		}
	}

	png.computeBitsPerPixel() ;

	return png ;
} ;



// PNG constants

JsGFF.COLOR_TYPE_GRAYSCALE = 0 ;
JsGFF.COLOR_TYPE_RGB = 2 ;
JsGFF.COLOR_TYPE_INDEXED = 3 ;
JsGFF.COLOR_TYPE_GRAYSCALE_ALPHA = 4 ;
JsGFF.COLOR_TYPE_RGBA = 6 ;



// Chunk/Buffer constants

const CHUNK_META_SIZE = 12 ;
// A PNG file always starts with this bytes
const PNG_MAGIC_NUMBERS = [ 0x89 , 0x50 , 0x4E , 0x47 , 0x0D , 0x0A , 0x1A , 0x0A ] ;
const PNG_MAGIC_NUMBERS_BUFFER = Buffer.from( PNG_MAGIC_NUMBERS ) ;
const IEND_CHUNK = [	// Instead of triggering the whole chunk machinery, just put this pre-computed IEND chunk
	0x00 , 0x00 , 0x00 , 0x00 ,		// Zero-length
	0x49 , 0x45 , 0x4e , 0x44 ,		// IEND
	0xae , 0x42 , 0x60 , 0x82		// CRC-32 of IEND
] ;
const IEND_CHUNK_BUFFER = Buffer.from( IEND_CHUNK ) ;



// Sadly it should be async, because browser's Compression API works with streams
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



JsGFF.prototype.download = async function( filename , options = {} ) {
	var buffer = await this.encode( options ) ;
	await download( filename , buffer ) ;
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

