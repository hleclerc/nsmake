require( "console-stamp" )( console, { pattern : "dd/mm/yyyy HH:MM:ss.l" } );
import CommunicationEnvironment from "./CommunicationEnvironment"
import CompilationEnvironment   from "./CompilationEnvironment"
import FileDependencies         from "./FileDependencies"
import CompilationNode          from "./CompilationNode"
import ArgumentParser           from './ArgumentParser';
import Processor                from "./Processor"
import SpRepr                   from "./SpRepr"
import * as rimraf              from 'rimraf';
import * as async               from 'async';
import * as path                from 'path';
import * as net                 from 'net'
import * as fs                  from 'fs'

// helpers for basic communication to the client
function send_out( connection: net.Socket, msg : string ) { connection.write( `I  ${ SpRepr.encode( msg + "\n" ) }\n` ); }
function send_err( connection: net.Socket, msg : string ) { connection.write( `E  ${ SpRepr.encode( msg + "\n" ) }\n` ); }
function send_end( connection: net.Socket, code: string | number ) {
    if ( typeof code == "string" ) { send_err( connection, code ); return send_end( connection, 1 ); }
    connection.end( `X ${ code.toString() }\n` );
}

/** launch a build seq. return a function to be called if a stop is wanted */
function parse_and_build( c: net.Socket, proc: Processor, cwd: string, nb_columns: number, argv: Array<string> ) : () => void {
    // define common argument types (mission independant)
    var p = new ArgumentParser( path.basename( argv[ 0 ] ), 'an hopefully less dummy build system', '0.0.1' );
    p.add_argument( [], [], 'v,version'  , 'get version number'                                                                       , 'boolean' );
    p.add_argument( [], [], 'w,watch'    , 'watch files, reconstruct dependencies if changed'                                         , 'boolean' );
    p.add_argument( [], [], 'config-dir' , "specify the configuration directory (default: '~/.nsmake')"                               , "path"    );
    p.add_argument( [], [], 'inotify'    , 'if -w or --watch, watch using inotify or equivalent (unsafe but consumes less ressources)', 'boolean' );
    p.add_argument( [], [], 'watch-delay', 'if -w or --watch and method==polling, delay between tests, in ms'                                     );

    // make a new environment
    let env = new CompilationEnvironment( new CommunicationEnvironment( c, proc, nb_columns ), cwd );
    env.decl_additional_options( p );

    // read arguments from the command line. args will contain number where CompilationNode are expected (numbers are indices to targets)
    let targets = new Array<string>();
    p.parse_args( env.args, targets, argv.slice( 1 ), cwd );

    // Mgmt of trivial flags.
    if ( env.args.version            ) { send_out( c, `${ p.prg_name } version: ${ p.version }` );                                              }
    if ( env.args._error             ) { send_end( c, env.args._msg );                                                         return () => {}; }
    if ( env.args.help               ) { send_out( c, p.format_help( env.args, nb_columns ) ); send_end( c, 0 );               return () => {}; }
    if ( ! env.args.mission          ) { send_end( c, 'Please define a mission' );                                             return () => {}; }
    if ( env.args.mission == "help"  ) { send_out( c, p.format_help( env.args, nb_columns ) ); send_end( c, 0 );               return () => {}; }
    if ( env.args.mission == "clean" ) { send_out( c, `Cleaning all the build files` ); proc.clean( err => send_end( c, 0 ) ); return () => {}; }
    if ( env.args.mission == "stop"  ) { process.exit( 0 );                                                                                     }

    // called when compilation is ended
    const end_comp = ( err: boolean, file_deps: FileDependencies ) => {
        if ( env.com.active )
            send_end( env.com.c, err ? 1 : 0 );
        env.com.active = false;
    }

    // fill inp_cns and replace compilation nodes string attributes by numbers
    let file_deps = new FileDependencies;
    async.forEach( [ ...targets.keys() ], ( num_target: number, cb: ( boolean ) => void ) => {
        env.get_compilation_node( targets[ num_target ], cwd, file_deps, cn => {
            if ( ! cn ) send_err( c, `Error: don't known how to read or build target '${ targets[ num_target ] }'` );
            env.cns[ num_target ] = cn;
            cb( cn == null );
        } );
    }, ( err: boolean ) => {
        if ( err )
            return end_comp( true, file_deps );

        // start a new build sequence
        function at_wait( nb ) { env.com.note( null, nb > 1 ? `Waiting for another builds to complete (${ nb } tasks)` : `Waiting for another build to complete` ); }
        function at_launch() { env.com.note( null, `Launching build` ); }
        proc.start_new_build_seq( at_wait, at_launch, done_cb => {
            // compilation of input CompilationNodes
            async.forEach( env.cns, ( cn: CompilationNode, cb_comp ) => {
                proc.make( env, cn, cb_comp );
            }, ( err: boolean ) => {
                if ( err ) {
                    end_comp( err, file_deps );
                    done_cb();
                } else {
                    // get mission node
                    env.get_mission_node( file_deps, mission_node => {
                        if ( ! mission_node ) {
                            send_err( c, `Error: don't known what to do for args ${ JSON.stringify( env.args ) }` );
                            end_comp( true, file_deps );
                            return done_cb();
                        }
                        // compilation if mission node
                        proc.make( env, mission_node, err => {
                            end_comp( err, file_deps );
                            done_cb();
                        } );
                    } );
                }
            } );
        } );
    } );

    // callback to interrupt the tasks linked to this communication channel
    return () => {
        env.com.active = false;
        proc.stop_tasks_from( env.com );
    };
}


// arguments
const nsmake_dir = process.argv[ 2 ];
const fifo_file  = process.argv[ 3 ];
const info_file  = process.argv[ 4 ];

// central task manager
let proc = new Processor( nsmake_dir );
process.on( 'exit', code => { proc.kill_all(); } );

// creation of the server connection 
const server = net.createServer( c => {
    // if interruption of the client
    let end_func = null as () => void;
    c.on( 'end', () => { if ( end_func ) end_func(); } );

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
                        const cur_dir = args[ 1 ], nb_columns = Number( args[ 2 ] );
                        end_func = parse_and_build( c, proc, cur_dir, nb_columns, args.slice( 3 ) );
                    } catch ( e ) {
                        try {
                            send_end( c, `Message from the nsmake server: ${ e.stack }\n` );
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
                    send_end( c, `Unknown command '${ args[ 0 ] }'` );
                }
            }
            lines = lines.slice( index_lf + 1 );
        }
    } );
});

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
