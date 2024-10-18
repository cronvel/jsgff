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
	
	var fileData = jsGFF.createFileData( {
		title: "Some great title" ,
		author: "Bob"
	} ) ;
	fileData.addContent( 'txt' , "test test test" ) ;
	fileData.addContent( 'meta' , { description: "Photo of Paris at night" , date: new Date() } ) ;
	fileData.addContent( 'data' , Buffer.from( [ 0x43 , 0x10 , 0x56 , 0xaf ] ) ) ;
	await fileData.save( outputFile ) ;
}

write() ;

