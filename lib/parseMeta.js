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



// Adapted from json-kit + lxon



function parse( str ) {
	var v , runtime = { i: 0 } ;

	if ( typeof str !== 'string' ) {
		if ( str && typeof str === 'object' ) { str = str.toString() ; }
		else { throw new TypeError( "Argument #0 should be a string or an object with a .toString() method" ) ; }
	}

	v = parseTopLevelObject( str , runtime ) ;

	if ( runtime.i < str.length ) { throw new SyntaxError( "Unexpected " + str[ runtime.i ] + " at " + runtime.i ) ; }

	return v ;
}

module.exports = parse ;



function parseIdle( str , runtime ) {
	var c ;

	// Skip blank
	for ( ; runtime.i < str.length ; runtime.i ++ ) {
		c = str.charCodeAt( runtime.i ) ;
		if ( c > 0x20 || c === 0x0a ) { return c ; }
		if ( c === 0x20 ) { continue ; }
		throw new SyntaxError( "Unexpected '" + str[ runtime.i ] + "'" ) ;
	}

	return - 1 ;
}



function parseValue( str , runtime ) {
	var c ;

	c = str.charCodeAt( runtime.i ) ;

	if ( c === 0x2d ) {	// minus
		runtime.i ++ ;
		parseIdle( str , runtime ) ;
		c = str.charCodeAt( runtime.i ) ;
		if ( ( c >= 0x41 && c <= 0x5a ) || ( c >= 0x61 && c <= 0x7a ) ) {
			runtime.i ++ ;
			return parseLxonConstant( str , runtime , LXON_NEGATIVE_CONSTANTS ) ;
		}

		if ( c >= 0x30 && c <= 0x39 ) {	// digit
			return parseNegativeNumber( str , runtime ) ;
		}

		throw new SyntaxError( "Unexpected " + str[ runtime.i ] ) ;
	}

	if ( c >= 0x30 && c <= 0x39 ) {	// digit
		return parseNumber( str , runtime ) ;
	}

	runtime.i ++ ;

	switch ( c ) {
		case 0x7b :	// {
			return parseObject( str , runtime ) ;
		case 0x5b :	// [
			return parseArray( str , runtime ) ;
		case 0x22 :	// "   double-quote: this is a string
			return parseString( str , runtime ) ;
		case 0x5f :	// _
			return parseDate( str , runtime ) ;
		default :
			if ( ( c >= 0x41 && c <= 0x5a ) || ( c >= 0x61 && c <= 0x7a ) ) {
				return parseLxonConstant( str , runtime ) ;
			}

			throw new SyntaxError( "Unexpected " + str[ runtime.i - 1 ] ) ;
	}
}




// Map.has() is way faster than (key in Object) (at least on Node.js v16)
const LXON_CONSTANTS = new Map( [
	[ 'null' , null ] ,
	[ 'false' , false ] ,
	[ 'true' , true ] ,
	[ 'NaN' , NaN ] ,
	[ 'nan' , NaN ] ,
	[ 'Infinity' , Infinity ] ,
	[ 'infinity' , Infinity ]
] ) ;

const LXON_NEGATIVE_CONSTANTS = new Map( [
	[ 'Infinity' , - Infinity ] ,
	[ 'infinity' , - Infinity ]
] ) ;

function parseLxonConstant( str , runtime , constants = LXON_CONSTANTS ) {
	var c , id , j = runtime.i , l = str.length ;

	for ( ; j < l ; j ++ ) {
		c = str.charCodeAt( j ) ;

		// Lxon constants are: [a-zA-Z]+
		// The first char is already parsed
		if ( ! ( ( c >= 0x41 && c <= 0x5a ) || ( c >= 0x61 && c <= 0x7a ) ) ) {
			break ;
		}
	}

	id = str.slice( runtime.i - 1 , j ) ;
	if ( ! constants.has( id ) ) {
		throw new SyntaxError( "Unexpected " + id ) ;
	}

	runtime.i = j ;
	return constants.get( id ) ;
}



function parseNumber( str , runtime ) {
	// We are here because a digit or a minus triggered parseNumber(), so we assume that the regexp always match
	var match = str.slice( runtime.i ).match( /^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/ )[ 0 ] ;
	runtime.i += match.length ;
	return parseFloat( match ) ;
}



function parseNegativeNumber( str , runtime ) {
	// We are here because a digit triggered parseNumber(), so we assume that the regexp always match
	var match = str.slice( runtime.i ).match( /^[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/ )[ 0 ] ;
	runtime.i += match.length ;
	return - parseFloat( match ) ;
}



function parseDate( str , runtime ) {
	var c = str.charCodeAt( runtime.i ) ;
	if ( c !== 0x22 ) {		// "   double-quote: this is a string
		throw new SyntaxError( "Unexpected " + str[ runtime.i ] ) ;
	}

	runtime.i ++ ;

	var isoString = parseString( str , runtime ) ;
	return new Date( isoString ) ;
}



function parseString( str , runtime ) {
	var c , j = runtime.i , l = str.length , v = '' ;

	for ( ; j < l ; j ++ ) {
		c = str.charCodeAt( j ) ;

		// This construct is intended: this is much faster (15%)
		if ( c === 0x22 || c === 0x5c || c <= 0x1f ) {
			if ( c === 0x22	) {	// double quote = end of the string
				v += str.slice( runtime.i , j ) ;
				runtime.i = j + 1 ;
				return v ;
			}
			else if ( c === 0x5c ) {	// backslash
				v += str.slice( runtime.i , j ) ;
				runtime.i = j + 1 ;
				v += parseBackSlash( str , runtime ) ;
				j = runtime.i - 1 ;
			}
			else if ( c <= 0x1f ) {	// illegal
				throw new SyntaxError( "Unexpected control char 0x" + c.toString( 16 ) ) ;
			}
		}
	}

	throw new SyntaxError( "Unexpected end, expecting a double-quote." ) ;
}



var parseBackSlashLookup_ =
( function createParseBackSlashLookup() {
	var c = 0 , lookup = new Array( 0x80 ) ;

	for ( ; c < 0x80 ; c ++ ) {
		if ( c === 0x62 ) {	// b
			lookup[ c ] = '\b' ;
		}
		else if ( c === 0x66 ) {	// f
			lookup[ c ] = '\f' ;
		}
		else if ( c === 0x6e ) {	// n
			lookup[ c ] = '\n' ;
		}
		else if ( c === 0x72 ) {	// r
			lookup[ c ] = '\r' ;
		}
		else if ( c === 0x74 ) {	// t
			lookup[ c ] = '\t' ;
		}
		else if ( c === 0x5c ) {	// backslash
			lookup[ c ] = '\\' ;
		}
		else if ( c === 0x2f ) {	// slash
			lookup[ c ] = '/' ;
		}
		else if ( c === 0x22 ) {	// double-quote
			lookup[ c ] = '"' ;
		}
		else {
			lookup[ c ] = '' ;
		}
	}

	return lookup ;
} )() ;



function parseBackSlash( str , runtime ) {
	var v , c = str.charCodeAt( runtime.i ) ;

	if ( runtime.i >= str.length ) { throw new SyntaxError( "Unexpected end" ) ; }

	if ( c === 0x75 ) {	// u
		runtime.i ++ ;
		v = parseUnicode( str , runtime ) ;
		return v ;
	}
	else if ( ( v = parseBackSlashLookup_[ c ] ).length ) {
		runtime.i ++ ;
		return v ;
	}

	throw new SyntaxError( 'Unexpected token: "' + str[ runtime.i ] + '"' ) ;

}



function parseUnicode( str , runtime ) {
	if ( runtime.i + 3 >= str.length ) { throw new SyntaxError( "Unexpected end" ) ; }

	var match = str.slice( runtime.i , runtime.i + 4 ).match( /[0-9a-f]{4}/ ) ;

	if ( ! match ) { throw new SyntaxError( "Unexpected " + str.slice( runtime.i , runtime.i + 4 ) ) ; }

	runtime.i += 4 ;

	// Or String.fromCodePoint() ?
	return String.fromCharCode( Number.parseInt( match[ 0 ] , 16 ) ) ;
}



function parseLxonUnquotedKey( str , runtime ) {
	var c , v , j = runtime.i + 1 , l = str.length ;

	for ( ; j < l ; j ++ ) {
		c = str.charCodeAt( j ) ;

		// Lxon keys are: [@a-zA-Z0-9_$-]+
		// The first char is already parsed
		if ( ! ( ( c >= 0x40 && c <= 0x5a ) || ( c >= 0x61 && c <= 0x7a ) || ( c >= 0x30 && c <= 0x39 ) || c === 0x5f || c === 0x24 || c === 0x2d ) ) {
			v = str.slice( runtime.i , j ) ;
			runtime.i = j ;
			return v ;
		}
	}

	throw new SyntaxError( "Unexpected end, expecting a colon." ) ;
}



function parseArray( str , runtime ) {
	var j = 0 , c , v = [] ;

	// Empty array? Try to parse a ]
	c = parseIdle( str , runtime ) ;
	if ( c === 0x5d ) {
		runtime.i ++ ;
		return v ;
	}

	for ( ;; j ++ ) {
		// parse the value :
		v[ j ] = parseValue( str , runtime ) ;


		// parse comma , or end of array
		c = parseIdle( str , runtime ) ;
		switch ( c ) {
			case 0x2c :	// ,   comma: next value
				runtime.i ++ ;
				break ;

			case 0x5d :	// ]
				runtime.i ++ ;
				return v ;

			default :
				throw new Error( "Unexpected " + str[ runtime.i ] ) ;
		}

		parseIdle( str , runtime ) ;
	}

	//throw new Error( "Unexpected end" ) ;
}



function parseObject( str , runtime ) {
	var c , v , k ;

	// Empty object? Try to parse a }
	c = parseIdle( str , runtime ) ;
	if ( c === 0x7d ) {
		runtime.i ++ ;
		return {} ;
	}

	v = {} ;

	for ( ;; ) {
		// parse the key
		k = parseKey( str , runtime , c ) ;

		// parse the colon :
		c = parseIdle( str , runtime ) ;
		if ( c !== 0x3a ) { throw new Error( "Unexpected " + str[ runtime.i ] ) ; }
		runtime.i ++ ;

		// parse the value
		parseIdle( str , runtime ) ;
		v[ k ] = parseValue( str , runtime ) ;

		// parse comma , or end of object
		c = parseIdle( str , runtime ) ;
		switch ( c ) {
			case 0x2c :	// ,   comma: next key-value
				runtime.i ++ ;
				break ;

			case 0x7d :	// }
				runtime.i ++ ;
				return v ;

			default :
				throw new Error( "Unexpected " + str[ runtime.i ] ) ;
		}

		c = parseIdle( str , runtime ) ;
	}

	//throw new Error( "Unexpected end" ) ;
}



function parseTopLevelObject( str , runtime ) {
	var c , v , k ;

	// Empty object? Try to parse a newline
	if ( runtime.i >= str.length ) { return {} ; }

	v = {} ;
	c = str.charCodeAt( runtime.i ) ;

	while ( runtime.i < str.length ) {
		// parse the key
		k = parseKey( str , runtime , c ) ;

		// parse the colon :
		c = parseIdle( str , runtime ) ;
		if ( c !== 0x3a ) { throw new Error( "Unexpected " + str[ runtime.i ] ) ; }
		runtime.i ++ ;

		// parse the value
		parseIdle( str , runtime ) ;
		v[ k ] = parseValue( str , runtime ) ;

		// parse comma , or end of object
		c = parseIdle( str , runtime ) ;
		if ( c === 0x0a ) {	// newline: next key-value
			runtime.i ++ ;
			c = str.charCodeAt( runtime.i ) ;
		}
		else {
			throw new Error( "Unexpected " + str[ runtime.i ] ) ;
		}
	}

	return v ;
}



function parseKey( str , runtime , c ) {
	// Lxon keys are: [@a-zA-Z0-9_$-]+
	if ( ( c >= 0x40 && c <= 0x5a ) || ( c >= 0x61 && c <= 0x7a ) || ( c >= 0x30 && c <= 0x39 ) || c === 0x5f || c === 0x24 || c === 0x2d ) {
		return parseLxonUnquotedKey( str , runtime ) ;
	}

	if ( c !== 0x22 ) { throw new Error( "Unexpected " + str[ runtime.i ] ) ; }
	runtime.i ++ ;
	return parseString( str , runtime ) ;
}

