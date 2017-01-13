/**
 * Write the content of a YAML file in module.exports (as JSON data)
 */
const fs = require( "fs" ), yaml = require( "js-yaml" );

console.log( "module.exports = " + JSON.stringify( yaml.safeLoad( fs.readFileSync( process.argv[ 2 ] ).toString() ) ) + ";" );
