require( "console-stamp" )( console, { pattern : "dd/mm/yyyy HH:MM:ss.l" } );
import ParseArgvAndBuildMission from "./ParseArgvAndBuildMission"
// import CommunicationEnvironment from "./CommunicationEnvironment"
// import CompilationEnvironment   from "./CompilationEnvironment"
// import FileDependencies         from "./FileDependencies"
// import CompilationNode          from "./CompilationNode"
// import ArgumentParser           from './ArgumentParser';
import { SystemInfo }           from "./SystemInfo"
import Processor                from "./Processor"
import SpRepr                   from "./SpRepr"
import * as rimraf              from 'rimraf';
import * as net                 from 'net'
import * as fs                  from 'fs'
import * as os                  from 'os'
const getos = require( 'getos' );

// 
function on_new_connection( c: net.Socket, proc: Processor ) {
    let parse_and_build = new ParseArgvAndBuildMission( c, proc );

    // if interruption of the client
    c.on( 'end', () => parse_and_build.interrupt() );

    // if data coming from the client
    let lines = "";
    c.on( 'data', ( data ) => {
        lines += data.toString();
        const index_lf = lines.lastIndexOf( "\n" );
        if ( index_lf >= 0 ) {
            for( const line of lines.slice( 0, index_lf ).split( "\n" ) ) {
                const args = line.split( " " ).map( x => SpRepr.decode( x ) );
                switch ( args[ 0 ] ) {
                case "build":
                    try {
                        const cur_dir = args[ 1 ], nb_columns = Number( args[ 2 ] ) - ( os.platform() == 'win32' ? 1 : 0 ), stdin_isTTY = args[ 3 ] == 'true', stdout_isTTY = args[ 4 ] == 'true';
                        parse_and_build.start_a_new_build( cur_dir, nb_columns, stdin_isTTY, stdout_isTTY, args.slice( 5 ) );
                    } catch ( e ) {
                        try {
                            parse_and_build.send_end( `Message from the nsmake server: ${ e.stack }\n` );
                        } catch ( e ) {}
                    }
                    break;
                case "spawn_done":
                    proc._spawn_is_done( args[ 1 ], Number( args[ 2 ] ) );
                    break;
                case "exit":
                    process.exit( 0 );
                    break;
                default:
                    parse_and_build.send_end( `Unknown command '${ args[ 0 ] }'` );
                }
            }
            lines = lines.slice( index_lf + 1 );
        }
    } );
}

// arguments
const nsmake_dir = process.argv[ 2 ];
const fifo_file  = process.argv[ 3 ];
const info_file  = process.argv[ 4 ];

// get os information, wait for clients
getos( ( err, si ) => {
    if ( err )
        return console.error( `Error while trying to get os information: ${ err }` );
    const system_info = {
        os      : si.os,
        dist    : si.dist,
        codename: si.codename,
        release : Number( si.release ),
    } as SystemInfo;

    // central task manager
    let proc = new Processor( nsmake_dir, system_info );
    process.on( 'exit', code => proc.kill_all() );
    process.on( 'uncaughtException', err => console.error( err ) );

    // creation of the server connection 
    const server = net.createServer( c => {
        on_new_connection( c, proc );
    } );

    server.listen( fifo_file, () => {
        // to delete the files at the end
        function clean( msg: string ) { console.log( msg ); rimraf.sync( fifo_file ); rimraf.sync( info_file ); }
        function sigxx( msg: string ) { console.log( msg ); process.exit( 1 ); }
        process.on( 'SIGTERM', () => sigxx( "Server received a SIGTERM" ) );
        process.on( 'SIGINT' , () => sigxx( "Server received a SIGINT" ) );
        process.on( 'exit'   , () => clean( "Server exited" ) );

        //
        fs.mkdir( nsmake_dir, err => {
            fs.writeFile( info_file, `${ process.pid } ${ new Date().getTime() }`, err => {
                console.log( `Server started on ${ fifo_file }` );
            } );
        } );
    });

    server.on( 'error', ( err ) => {
        throw err;
    } );
} );
