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



function stringify( v ) {
	if ( v === undefined ) { return undefined ; }

	var runtime = {
		str: ''
	} ;

	stringifyTopLevelObject( v , runtime ) ;

	return runtime.str ;
}

module.exports = stringify ;



function stringifyAnyType( v , runtime ) {
	if ( v === undefined || v === null ) {
		runtime.str += "null" ;
		return ;
	}

	switch ( typeof v ) {
		case 'boolean' :
			return stringifyBoolean( v , runtime ) ;
		case 'number' :
			return stringifyNumber( v , runtime ) ;
		case 'string' :
			return stringifyString( v , runtime ) ;
		case 'object' :
			if ( Array.isArray( v ) ) { return stringifyArray( v , runtime ) ; }
			if ( v instanceof Date ) { return stringifyDate( v , runtime ) ; }
			return stringifyObject( v , runtime ) ;
		default :
			runtime.str += "null" ;
			return ;
	}
}



function stringifyBoolean( v , runtime ) {
	runtime.str += ( v ? "true" : "false" ) ;
}



function stringifyNumber( v , runtime ) {
	if ( Number.isNaN( v ) ) { runtime.str += "NaN" ; }
	else if ( v === Infinity ) { runtime.str += "Infinity" ; }
	else if ( v === - Infinity ) { runtime.str += "-Infinity" ; }
	else { runtime.str += v ; }
}



function stringifyDate( v , runtime ) {
	runtime.str += '_"' + v.toISOString() + '"' ;
}



function stringifyString( v , runtime ) {
	var i = 0 , l = v.length , c ;

	// Faster on big string than stringifyStringLookup(), also big string are more likely to have at least one bad char
	if ( l >= 200 ) { return stringifyStringRegex( v , runtime ) ; }

	// Most string are left untouched, so it's worth checking first if something must be changed.
	// Gain 33% of perf on the whole stringify().
	for ( ; i < l ; i ++ ) {
		c = v.charCodeAt( i ) ;

		if (
			c <= 0x1f ||	// control chars
			c === 0x5c ||	// backslash
			c === 0x22		// double quote
		) {
			if ( l > 100 ) { return stringifyStringRegex( v , runtime ) ; }
			return stringifyStringLookup( v , runtime ) ;
		}
	}

	runtime.str += '"' + v + '"' ;
}



// lxonUnquotedKeys
function stringifyLxonUnquotedKey( v , runtime ) {
	var i = 0 , l = v.length , c , hasLetter = false ;

	// Always prefer quotes for keys that are too big
	if ( l >= 100 ) { return stringifyStringRegex( v , runtime ) ; }

	for ( ; i < l ; i ++ ) {
		c = v.charCodeAt( i ) ;

		// Lxon keys are: [@a-zA-Z0-9_$-]+
		// But we will quote keys that have only numbers and '-' to avoid human reading confusions
		if ( ( c >= 0x40 && c <= 0x5a ) || ( c >= 0x61 && c <= 0x7a ) || c === 0x5f || c === 0x24 ) {
			// Character range: [@a-zA-Z_$]
			hasLetter = true ;
		}
		else if ( ! ( ( c >= 0x30 && c <= 0x39 ) || c === 0x2d ) ) {
			// Not in character range: [0-9-]
			return stringifyStringLookup( v , runtime ) ;
		}
	}

	if ( ! hasLetter ) {
		return stringifyStringLookup( v , runtime ) ;
	}

	runtime.str += v ;
}



var stringifyStringLookup_ =
( function createStringifyStringLookup() {
	var c = 0 , lookup = new Array( 0x80 ) ;

	for ( ; c < 0x80 ; c ++ ) {
		if ( c === 0x09 ) {	// tab
			lookup[ c ] = '\\t' ;
		}
		else if ( c === 0x0a ) {	// new line
			lookup[ c ] = '\\n' ;
		}
		else if ( c === 0x0c ) {	// form feed
			lookup[ c ] = '\\f' ;
		}
		else if ( c === 0x0d ) {	// carriage return
			lookup[ c ] = '\\r' ;
		}
		else if ( c <= 0x0f ) {	// control chars
			lookup[ c ] = '\\u000' + c.toString( 16 ) ;
		}
		else if ( c <= 0x1f ) {	// control chars
			lookup[ c ] = '\\u00' + c.toString( 16 ) ;
		}
		else if ( c === 0x5c ) {	// backslash
			lookup[ c ] = '\\\\' ;
		}
		else if ( c === 0x22 ) {	// double-quote
			lookup[ c ] = '\\"' ;
		}
		else {
			lookup[ c ] = String.fromCharCode( c ) ;
		}
	}

	return lookup ;
} )() ;



function stringifyStringLookup( v , runtime ) {
	var i = 0 , iMax = v.length , c ;

	runtime.str += '"' ;

	for ( ; i < iMax ; i ++ ) {
		c = v.charCodeAt( i ) ;

		if ( c < 0x80 ) {
			runtime.str += stringifyStringLookup_[ c ] ;
		}
		else {
			runtime.str += v[ i ] ;
		}
	}

	runtime.str += '"' ;
}



var stringifyStringRegex_ = /[\x00-\x1f"\\]/g ;

function stringifyStringRegex( v , runtime ) {
	runtime.str += '"' + v.replace( stringifyStringRegex_ , stringifyStringRegexCallback ) + '"' ;
}

function stringifyStringRegexCallback( match ) {
	return stringifyStringLookup_[ match.charCodeAt( 0 ) ] ;
}



function stringifyArray( v , runtime ) {
	if ( ! v.length ) {
		runtime.str += '[]' ;
		return ;
	}

	runtime.str += '[' ;

	for ( let i = 0 ; i < v.length ; i ++ ) {
		if ( i ) { runtime.str += ',' ; }
		stringifyAnyType( v[ i ] , runtime ) ;
	}

	runtime.str += ']' ;
}



function stringifyObject( v , runtime ) {
	var hasValue = false ,
		keys = Object.keys( v ) ;

	if ( ! keys.length ) {
		runtime.str += '{}' ;
		return ;
	}

	runtime.str += '{' ;

	for ( let i = 0 ; i < keys.length ; i ++ ) {
		if ( v[ keys[ i ] ] !== undefined ) {
			if ( hasValue ) { runtime.str += ',' ; }
			stringifyLxonUnquotedKey( keys[ i ] , runtime ) ;
			runtime.str += ':' ;
			stringifyAnyType( v[ keys[ i ] ] , runtime ) ;
			hasValue = true ;
		}
	}

	runtime.str += '}' ;
}



function stringifyTopLevelObject( v , runtime ) {
	var keys = Object.keys( v ) ;

	if ( ! keys.length ) { return ; }

	for ( let i = 0 ; i < keys.length ; i ++ ) {
		if ( v[ keys[ i ] ] !== undefined ) {
			stringifyLxonUnquotedKey( keys[ i ] , runtime ) ;
			runtime.str += ':' ;
			stringifyAnyType( v[ keys[ i ] ] , runtime ) ;
			runtime.str += '\n' ;
		}
	}
}

