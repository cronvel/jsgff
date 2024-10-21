#!/usr/bin/env node
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

const JsGFF = require( '..' ) ;



// Argument management

if ( process.argv.length < 3 ) {
	console.error( "Expecting a file" ) ;
	process.exit( 1 ) ;
}

var outputFile = process.argv[ 2 ] ;

async function write() {
	var jsGFF = new JsGFF( {
		formatCodeName: 'test' ,
		debug: true ,
		mandatoryContents: [ 'image' ] ,

		// TODO: headers definitions
		headersDef: {
			title: [ true , 'string' ] ,
			size: [ false , 'object' , {
				width: [ true , 'number' ] ,
				height: [ true , 'number' ]
			} ] ,
			indexes: [ false , 'arrayOf' , 'number' ] ,
		}
	} ) ;
	
	var fileData = jsGFF.createFileData( {
		title: "Some great title" ,
		author: "Bob"
	} ) ;
	fileData.setMetadata( { date: new Date() } ) ;

	fileData.addContent( 'txt' , "test test test" , null , { deflate: true } ) ;
	fileData.addContent( 'meta' , { description: "Photo of Paris at night" , date: new Date() } , null , { deflate: true } ) ;
	fileData.addContent( 'data' , Buffer.from( [ 0x43 , 0x10 , 0x56 , 0xaf ] ) ) ;
	fileData.addContent( 'image' , Buffer.from( [ 0x78 , 0x11 , 0xa6 , 0xfe ] ) , {
		width: 10 ,
		height: 20
	} ) ;
	fileData.addContent( 'compressed-image' , Buffer.from( [ 0x78 , 0x11 , 0xa6 , 0xfe , 0x44 , 0x43 , 0x10 , 0x56 , 0xaf ] ) , {
		width: 60 ,
		height: 40
	} , {
		deflate: true
	} ) ;

	await fileData.save( outputFile ) ;
}

write() ;

