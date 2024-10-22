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

/* global expect, describe, it, before, after */



const JsGFF = require( '..' ) ;



describe( "Parse/stringify meta (headers, etc)" , () => {
	
	it( "should stringify and parse an empty object" , () => {
		var object , str , parsedObject ;
		
		object = {} ;
		str = JsGFF.stringifyMeta( object ) ;
		expect( str ).to.be( '' ) ;
		parsedObject = JsGFF.parseMeta( str ) ;
		console.log( "parsedObject:" , parsedObject ) ;
		expect( object ).to.equal( parsedObject ) ;
	} ) ;

	it( "should stringify and parse simple object" , () => {
		var object , str , parsedObject ;
		
		object = { width: 640 , height: 480 , title: "A beautiful picture" } ;
		str = JsGFF.stringifyMeta( object ) ;
		expect( str ).to.be( 'width:640\nheight:480\ntitle:"A beautiful picture"\n' ) ;
		parsedObject = JsGFF.parseMeta( str ) ;
		console.log( "parsedObject:" , parsedObject ) ;
		expect( object ).to.equal( parsedObject ) ;
	} ) ;

	it( "should stringify and parse constants" , () => {
		var object , str , parsedObject ;

		object = { a: true , b: false , c: null , d: Infinity , e: - Infinity } ;
		str = JsGFF.stringifyMeta( object ) ;
		expect( str ).to.be( 'a:+\nb:-\nc:*\nd:inf\ne:-inf\n' ) ;
		parsedObject = JsGFF.parseMeta( str ) ;
		console.log( "parsedObject:" , parsedObject ) ;
		expect( object ).to.equal( parsedObject ) ;

		object = { sub: { a: true , b: false , c: null , d: Infinity , e: - Infinity } } ;
		str = JsGFF.stringifyMeta( object ) ;
		expect( str ).to.be( 'sub:{a:+,b:-,c:*,d:inf,e:-inf}\n' ) ;
		parsedObject = JsGFF.parseMeta( str ) ;
		console.log( "parsedObject:" , parsedObject ) ;
		expect( object ).to.equal( parsedObject ) ;
		
		// Nan is always removed
		object = { n1: NaN , a: true , b: false , c: null , n2: NaN , d: Infinity , e: - Infinity , n3: NaN } ;
		str = JsGFF.stringifyMeta( object ) ;
		expect( str ).to.be( 'a:+\nb:-\nc:*\nd:inf\ne:-inf\n' ) ;
	} ) ;

	it( "should stringify and parse date" , () => {
		var object , str , parsedObject ;
		
		object = { date: new Date( '2024-10-22T08:55:22.000Z' ) } ;
		str = JsGFF.stringifyMeta( object ) ;
		expect( str ).to.be( 'date:_"2024-10-22T08:55:22.000Z"\n' ) ;
		parsedObject = JsGFF.parseMeta( str ) ;
		console.log( "parsedObject:" , parsedObject ) ;
		expect( object ).to.equal( parsedObject ) ;
	} ) ;

	it( "should stringify and parse nested objects" , () => {
		var object , str , parsedObject ;
		
		object = { width: 640 , height: 480 , sub: {a:1,b:2,array:[1,2,3]} } ;
		str = JsGFF.stringifyMeta( object ) ;
		expect( str ).to.be( 'width:640\nheight:480\nsub:{a:1,b:2,array:[1,2,3]}\n' ) ;
		parsedObject = JsGFF.parseMeta( str ) ;
		console.log( "parsedObject:" , parsedObject ) ;
		expect( object ).to.equal( parsedObject ) ;
	} ) ;
} ) ;

