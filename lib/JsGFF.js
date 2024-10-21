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
	Should contains the format definition (not done ATM).

	It should include:

	* supported headers and their types (only: boolean, number, string, object and array)
	* which headers are mandatory
	* supported contentType and which content are mandatory
	* supported headers for each contentType and which headers are mandatory
*/
function JsGFF( params = {} ) {
	this.formatCodeName = params.formatCodeName || 'generic' ;
	this.magicNumbers = Buffer.from( 'JSGFF/' + this.formatCodeName + '\n' , 'latin1' ) ;
	this.debug = !! params.debug ;
}

module.exports = JsGFF ;

const FileData = JsGFF.FileData = require( './FileData.js' ) ;

JsGFF.stringifyMeta = require( './stringifyMeta.js' ) ;
JsGFF.parseMeta = require( './parseMeta.js' ) ;



JsGFF.prototype.createFileData = function( headers = {} , metadata = {} ) {
	return new FileData( this , headers , metadata ) ;
} ;

