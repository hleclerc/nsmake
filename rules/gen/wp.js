/**
 * Write file content as a `module.exports`
 */
const fs = require( "fs" );

console.log( "module.exports = " + JSON.stringify( fs.readFileSync( process.argv[ 2 ] ).toString() ) + ";" );
