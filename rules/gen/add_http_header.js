/**
 * usage: add_http_header content_type filename
 */
const fs = require( "fs" );

const content = fs.readFileSync( process.argv[ 2 ] );

// Transfer-Encoding: chunked
// Date: Sat, 28 Nov 2009 04:36:25 GMT
// Server: LiteSpeed
// X-Powered-By: W3 Total Cache/0.8
// Pragma: public
// Expires: Sat, 28 Nov 2009 05:36:25 GMT
// Etag: "pub1259380237;gz"
// Cache-Control: max-age=3600, public
// Last-Modified: Sat, 28 Nov 2009 03:50:37 GMT
// X-Pingback: http://net.tutsplus.com/xmlrpc.php
// Content-Encoding: gzip
// Vary: Accept-Encoding, Cookie, User-Agent

process.stdout.write(
`HTTP/1.0 200 OK
Connection: close
Content-Type: ${ process.argv[ 3 ] }; charset=UTF-8
Content-Length: ${ content.byteLength }

` );

process.stdout.write( content );
