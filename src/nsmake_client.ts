/**
 * nsmake_client is mainly here to send commands to the server, 
 * nsmake_client is also able to start or stop it
 */
import SpRepr             from "./SpRepr"
import Pager              from "./Pager"
import * as child_process from 'child_process'
import * as path          from 'path'
import * as net           from 'net'
import * as os            from 'os'

const homedir = require( 'homedir' );

/** get argument value */
function arg_val( flag: string, default_value: () => string, argv: Array<string> ): string {
    const res = argv.indexOf( flag );
    if ( res < 0 )
        return default_value();
    if ( res + 1 >= argv.length ) {
        console.error( `Flag ${ flag } must be followed by a value` );
        process.exit( 1 );
    }
    const out = argv[ res + 1 ];
    argv.splice( res, 2 ); 
    return out
}

/** wait stop_cond to be checked */
function wait_for( stop_cond: ( cb: ( boolean ) => void ) => void, cb_ko: () => void, cb_ok: () => void, delay = 100, max_cpt = 100 ) {
    let cpt = 0;
    function wait() {
        stop_cond( ( checked: boolean ) => {
            if ( checked )
                return cb_ok();
            if ( ++cpt > max_cpt )
                return cb_ko();
            setTimeout( wait, delay );
        } );
    }
    wait();
}

/** */
function start_server( nsmake_dir: string, fifo_file: string, cb_ready: () => void ) {
    const info_file = path.resolve( nsmake_dir, 'server.info' );
    const log_file  = path.resolve( nsmake_dir, 'server.log'  );
    const fs = require( "fs" );

    fs.mkdir( nsmake_dir, err => {
        if ( err && err.code != 'EEXIST' ) { console.error( err.toString() ); process.exit( 1 ); }

        // we remove info_file because presence will be used to wait for the server to be started
        require( 'rimraf' )( info_file, err => {
            // start a new server "--trace-deprecation", "--trace-warnings", "--debug=7000", 
            const child = child_process.spawn( process.argv[ 0 ], [ `${ __dirname }/nsmake_server.js`, nsmake_dir, fifo_file, info_file ], {
                detached: true,
                stdio   : [ 'ignore', fs.openSync( log_file, 'a' ), fs.openSync( log_file, 'a' ) ],
                cwd     : path.dirname( __dirname ) // notably to find node_modules for libraries (as babel) with dynamic loading
            } );
            child.unref();

            // wait for server to be started
            console.log( `Starting a new nsmake server instance (${ info_file })` );
            wait_for(
                ok_cond => fs.exists( info_file, ok_cond ),
                () => { console.error( `The nsmake server has not been started correctly: timeout has expired (see ${ log_file })` ); process.exit( 1 ); },
                cb_ready, 100, 50
            );
        } );
    } );
}

/** */
function spawn_local( client: net.Socket, id: string, redirect: string, cwd: string, executable: string, args: Array<string> ) {
    if ( redirect )
        throw new Error( "TODO" );
    const cp = child_process.spawn( executable, args, { env: process.env, stdio: [ 0, 1, 2 ], cwd } );
    cp.on( 'error', err  => client.write( `spawn_done ${ SpRepr.encode( id ) } ${ -1 }\n` ) );
    cp.on( 'exit' , code => client.write( `spawn_done ${ SpRepr.encode( id ) } ${ code == null ? -1 : code }\n` ) );
}

/** */
function exec_local( client: net.Socket, id: string, redirect: string, cwd: string, cmd: string ) {
    if ( redirect )
        throw new Error( "TODO" );
    const cp = child_process.spawn( cmd, [], { env: process.env, stdio: [ 0, 1, 2 ], shell: true, cwd } );
    cp.on( 'error', err  => client.write( `spawn_done ${ SpRepr.encode( id ) } ${ -1 }\n` ) );
    cp.on( 'exit' , code => client.write( `spawn_done ${ SpRepr.encode( id ) } ${ code == null ? -1 : code }\n` ) );
}

/** send `query` to the server. Spawn a new server if no connection */
function send_query( pager: Pager, nsmake_dir: string, type: string, cur_dir: string, nb_columns: string, args: Array<string>, start_server_allowed = true ) {
    // particular case
    if ( args[ 1 ] == "stop" ) {
        const fs = require( "fs" ), info_file = path.resolve( nsmake_dir, 'server.info' );
        try {
            const pid_file_data = Number( fs.readFileSync( info_file ).toString().split( " " )[ 0 ] );
            process.kill( pid_file_data );

            // wait for server to be effectively stopped
            return require( 'rimraf' )( info_file, err => {
                process.exit( 0 );
            } );
        } catch ( e ) {
            console.log( `It seems that the server was alreay stopped (${ e })` );
            process.exit( 0 );
        }

    }
    
    // communication channel
    const fifo_file = os.platform() == "win32" ? '\\\\.\\pipe\\nsmake_server' : path.resolve( nsmake_dir, 'server.fifo' );

    // send the message
    const client = net.createConnection( fifo_file, () => {
        client.write( [ type, cur_dir, nb_columns.toString(), ( process.stdin.isTTY || false ).toString(), ( process.stdout.isTTY || false ).toString(), ...args ].map( x => SpRepr.encode( x ) ).join( " " ) + "\n" );
        active_client = client;
    } );

    // no connection ? Try to spawn a new server.
    client.on( 'error', ( err: any ) => {
        switch ( err.code ) {
            case 'ECONNREFUSED':
            case 'ENOENT':
                // start a new server instance
                require( 'rimraf' )( fifo_file, err => {
                    if ( err )
                        console.log( "Error while trying to rm fifo file:", err );
                    start_server( nsmake_dir, fifo_file, () => {
                        send_query( pager, nsmake_dir, type, cur_dir, nb_columns, args, false );
                    } );
                } );
                break;
            case 'ECONNRESET':
                // end of connection before a 'X' cmd (which closes the connection from the client)
                console.error( 'Error: the nsmake server has been stopped.' );
                process.exit( 10 );
            default:
                console.error( 'Error: no connection to the nsmake server:', err );
                process.exit( 11 );
        }
    });

    // data from the server
    let lines = "";
    client.on( 'data', ( data ) => {
        lines += data.toString();
        const index_lf = lines.lastIndexOf( "\n" );
        if ( index_lf >= 0 ) {
            for( const line of lines.slice( 0, index_lf ).split( "\n" ) ) {
                const args = line.split( " " ).map( x => SpRepr.decode( x ) );
                switch ( args[ 0 ] ) {
                case "A": pager.write( args[ 1 ], args[ 2 ], 0 );                                             break; // annoucement on a given channel
                case "N": pager.write( args[ 1 ], args[ 2 ], 1 );                                             break; // note on a given channel
                case "I": pager.write( args[ 1 ], args[ 2 ], 2 );                                             break; // information on a given channel
                case "E": pager.write( args[ 1 ], args[ 2 ], 3 );                                             break; // error on a given channel
                case "C": pager.close( args[ 1 ] );                                                           break; // close channel
                case "X": process.exitCode = Number( args[ 1 ] ); pager.close_all(); client.end();            break; // end with code
                case "s": spawn_local( client, args[ 1 ], args[ 2 ], args[ 3 ], args[ 4 ], args.slice( 5 ) ); break; // execute something locally 
                case "e": exec_local ( client, args[ 1 ], args[ 2 ], args[ 3 ], args[ 4 ] );                  break; // execute something locally 
                default: console.log( "line:", line );
                }
            }
            lines = lines.slice( index_lf + 1 );
        }
    } );
}

// parse arguments needed by nsmake_client
let argv = [ ...process.argv ];
const nsmake_dir = arg_val( '--nsmake-dir', () => path.resolve( homedir(), ".nsmake" ), argv );

// handling of interruption
const on_sig = () => { if ( active_client ) active_client.write( "kill_client\n" ); else process.exit( 1 ); }
let active_client = null as net.Socket;
process.on( 'SIGINT' , on_sig );
process.on( 'SIGTERM', on_sig );

// launch
const pager = new Pager;
send_query( pager, nsmake_dir, "build", path.resolve(), ( process.stdout as any ).columns || 0, argv.slice( 1 ) );

