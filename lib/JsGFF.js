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



/*
	This is the format definition.

	It includes:

	* the format magic number
	* supported headers and their types (only: boolean, number, string, object and array), and which header is mandatory
	* supported contentType and which content is mandatory
	* supported headers for each contentType and which header is mandatory
*/
function JsGFF( params = {} ) {
	this.formatCodeName = params.formatCodeName || 'generic' ;
	this.magicNumbers = Buffer.from( 'JSGFF/' + this.formatCodeName + '\n' , 'latin1' ) ;

	// Enforcement
	this.mandatoryContents = Array.isArray( params.mandatoryContents ) ? new Set( params.mandatoryContents ) : new Set() ;
	this.headersDef = params.headersDef || null ;
	this.contentHeadersDef = params.contentHeadersDef || null ;
}

module.exports = JsGFF ;

const FileData = JsGFF.FileData = require( './FileData.js' ) ;

JsGFF.stringifyMeta = require( './stringifyMeta.js' ) ;
JsGFF.parseMeta = require( './parseMeta.js' ) ;



JsGFF.prototype.createFileData = function( headers = {} , metadata = {} ) {
	return new FileData( this , headers , metadata ) ;
} ;



JsGFF.prototype.checkRequirements = function( fileData ) {
	// First check mandatory contents
	for ( let contentType of this.mandatoryContents ) {
		if ( ! fileData.contents[ contentType ] || ! fileData.contents[ contentType ].length ) {
			throw new Error( "Corrupted " + this.formatCodeName + " file, missing content of type: " + contentType ) ;
		}
	}

	if ( this.headersDef ) {
		this.checkHeaders( fileData.headers , this.headersDef , '[file]' ) ;
	}

	if ( this.contentHeadersDef ) {
		for ( let contentType of Object.keys( this.contentHeadersDef ) ) {
			if ( fileData.contents[ contentType ] && fileData.contents[ contentType ].length ) {
				let index = 0 ;

				for ( let { headers } of fileData.contents[ contentType ] ) {
					this.checkHeaders( headers , this.contentHeadersDef[ contentType ] , '<' + contentType + '>' + '[' + index + ']' ) ;
					index ++ ;
				}
			}
		}
	}
} ;



JsGFF.prototype.checkHeaders = function( headers , def , prefix ) {
	for ( let key of Object.keys( def ) ) {
		this.checkHeaderValue( headers[ key ] , def[ key ] , prefix + '.' + key ) ;
	}
} ;



JsGFF.prototype.checkHeaderValue = function( headerValue , def , prefix ) {
	var [ mandatory , type , ofDef ] = def ;

	if ( headerValue === undefined ) {
		if ( mandatory ) { throw new Error( "Corrupted " + this.formatCodeName + " file, missing mandatory header: " + prefix ) ; }
		return ;
	}

	if ( headerValue === null ) {
		if ( mandatory ) { throw new Error( "Corrupted " + this.formatCodeName + " file, mandatory header can't be null: " + prefix ) ; }
		return ;
	}

	switch ( type )  {
		case 'boolean' :
			if ( typeof headerValue !== 'boolean' ) {
				throw new Error( "Corrupted " + this.formatCodeName + " file, expecting a boolean for header: " + prefix ) ;
			}

			break ;
		case 'number' :
			if ( typeof headerValue !== 'number' || Number.isNaN( headerValue ) ) {
				throw new Error( "Corrupted " + this.formatCodeName + " file, expecting a number for header: " + prefix ) ;
			}

			break ;
		case 'integer' :
			if ( typeof headerValue !== 'number' || ! Number.isSafeInteger( headerValue ) ) {
				throw new Error( "Corrupted " + this.formatCodeName + " file, expecting an integer for header: " + prefix ) ;
			}

			break ;
		case 'string' :
			if ( typeof headerValue !== 'string' ) {
				throw new Error( "Corrupted " + this.formatCodeName + " file, expecting a string for header: " + prefix ) ;
			}

			break ;
		case 'array' :
			if ( ! Array.isArray( headerValue ) ) {
				throw new Error( "Corrupted " + this.formatCodeName + " file, expecting an array for header: " + prefix ) ;
			}

			for ( let i = 0 ; i < headerValue.length ; i ++ ) {
				this.checkHeaderValue( headerValue[ i ] , ofDef , prefix + '.' + i ) ;
			}

			break ;
		case 'object' :
			if ( ! headerValue || typeof headerValue !== 'object' || Array.isArray( headerValue ) ) {
				throw new Error( "Corrupted " + this.formatCodeName + " file, expecting an object for header: " + prefix ) ;
			}

			for ( let key of Object.keys( def ) ) {
				this.checkHeaderValue( headerValue[ key ] , def[ key ] , prefix + '.' + key ) ;
			}

			break ;
	}
} ;

