/**
 * Write file content as a `module.exports`
 */
const cp = require( "child_process" ), fs = require( "fs" ), tmp = require( "tmp" );

const txt = `
const jl = require( "${ process.argv[ 2 ] }" ), fs = require( "fs" ), th = {};
fs.writeFileSync( process.argv[ 2 ], jl.bind( th )( fs.readFileSync( process.argv[ 3 ] ).toString() ) );
`;

tmp.file( { postfix: ".js" }, ( err, src_name, fd_src, cleanup_cb_src ) => {
    tmp.file( { postfix: ".js" }, ( err, out_name, fd_out, cleanup_cb_out ) => {
        fs.write( fd_src, txt, err => {
            fs.close( fd_src, err => {
                const rp = cp.spawn( "nsmake", [ "run", "--current-build-seq", src_name, out_name, process.argv[ 3 ] ], { stdio: [ 0, 2, 2 ] } );
                rp.on( 'close', code => {
                    process.stdout.write( fs.readFileSync( out_name ) );
                    cleanup_cb_src();
                    cleanup_cb_out();
                } );
            } );
        } );
    } );
} );