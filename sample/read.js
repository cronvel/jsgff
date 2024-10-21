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

var sourceFile = process.argv[ 2 ] ;

async function read() {
	var jsGFF = new JsGFF( {
		formatCodeName: 'test' ,
		debug: true ,
		mandatoryContents: [ 'image' ]
	} ) ;

	var fileData = jsGFF.createFileData() ;
	await fileData.load( sourceFile ) ;
	console.log( fileData ) ;
	
	for ( let contentType of Object.keys( fileData.contents ) ) {
		for ( let { content , headers , flags } of fileData.contents[ contentType ] ) {
			console.log( "\n>>> New content of type:" , contentType ) ;
			console.log( "Headers:" , headers ) ;
			console.log( "Flags:" , flags ) ;
			console.log( "Content:" , content ) ;
		}
	}
}

read() ;

