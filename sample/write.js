#!/usr/bin/env node

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
		debug: true
	} ) ;
	
	var fileData = jsGFF.createFileData() ;
	fileData.addContent( 'metadata' , "test test test" ) ;
	await fileData.save( outputFile ) ;
}

write() ;

