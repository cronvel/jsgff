#!/usr/bin/env node

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
		debug: true
	} ) ;

	var fileData = jsGFF.createFileData() ;
    await fileData.load( sourceFile ) ;
    console.log( fileData ) ;
}

read() ;

