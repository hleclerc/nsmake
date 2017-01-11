import CommunicationEnvironment from "./CommunicationEnvironment"
import CompilationEnvironment   from "./CompilationEnvironment"
import FileDependencies         from "./FileDependencies"
import CompilationNode          from "./CompilationNode"
import ArgumentParser           from './ArgumentParser';
import { SystemInfo }           from "./SystemInfo"
import Processor                from "./Processor"
import SpRepr                   from "./SpRepr"
import * as rimraf              from 'rimraf';
import * as async               from 'async';
import * as path                from 'path';
import * as net                 from 'net'
import * as fs                  from 'fs'
const getos = require( 'getos' );

/** */
export default
class ParseArgvAndBuildMission {
    constructor( c: net.Socket, proc: Processor ) {
        this.c           = c;
        this.proc        = proc;
    }

    /** with watch enabled if in argv */
    start_a_new_build( cwd: string, nb_columns: number, siTTY: boolean, soTTY: boolean, argv: Array<string> ) {
        this.cwd         = cwd;
        this.nb_columns  = nb_columns;
        this.siTTY       = siTTY;
        this.soTTY       = soTTY;
        this.argv        = argv;

        this._launch();
    }

    /** send a message to the client */
    send_out( msg : string ): void {
        this.c.write( `I  ${ SpRepr.encode( msg + "\n" ) }\n` );
    }

    /** send a error message to the client */
    send_err( msg : string ): void {
        this.c.write( `E  ${ SpRepr.encode( msg + "\n" ) }\n` );
    }
    
    /** */
    send_end( code: string | number ): void {
        if ( typeof code == "string" ) {
            this.send_err( code );
            return this.send_end( 1 );
        }
        this.c.end( `X ${ code.toString() }\n` );
    }

    /** */
    _launch(): void {
        // define common argument types (mission independant)
        var p = new ArgumentParser( path.basename( this.argv[ 0 ] ), 'an hopefully less dummy build system', '0.0.1' );
        p.add_argument( [], [], 'v,version'  , 'get version number'                                                                       , 'boolean' );
        p.add_argument( [], [], 'w,watch'    , 'watch files, reconstruct dependencies if changed'                                         , 'boolean' );
        p.add_argument( [], [], 'config-dir' , "specify the configuration directory (default: '~/.nsmake')"                               , "path"    );
        p.add_argument( [], [], 'inotify'    , 'if -w or --watch, watch using inotify or equivalent (unsafe but consumes less ressources)', 'boolean' );
        p.add_argument( [], [], 'watch-delay', 'if -w or --watch and method==polling, delay between tests, in ms'                                     );
        p.add_argument( [], [], 'no-root'    , 'Automatically refuse root/admin installations'                                            , 'boolean' );

        // make a new environment
        this.env = new CompilationEnvironment( new CommunicationEnvironment( this.c, this.proc, this.nb_columns, this.siTTY, this.soTTY ), this.cwd );
        this.env.decl_additional_options( p );

        // read arguments from the command line. args will contain number where CompilationNode are expected (numbers are indices to targets)
        let targets = new Array<string>();
        p.parse_args( this.env.args, targets, this.argv.slice( 1 ), this.cwd );

        // Handling of trivial flags.
        if ( this.env.args.version            ) { this.send_out( `${ p.prg_name } version: ${ p.version }` );                                    }
        if ( this.env.args._error             ) { this.send_end( this.env.args._msg );                                                   return; }
        if ( this.env.args.help               ) { this.send_out( p.format_help( this.env.args, this.nb_columns ) ); this.send_end( 0 );  return; }
        if ( ! this.env.args.mission          ) { this.send_end( 'Please define a mission' );                                            return; }
        if ( this.env.args.mission == "help"  ) { this.send_out( p.format_help( this.env.args, this.nb_columns ) );  this.send_end( 0 ); return; }
        if ( this.env.args.mission == "clean" ) { this.send_out( `Cleaning all the build files for directory ${ this.cwd }` );
                                                  this.proc.clean( this.cwd, err => this.send_end( 0 ) );                                return; }
        if ( this.env.args.mission == "stop"  ) { process.exit( 0 );                                                                             }

        // com environment
        this.env.com.no_root = this.env.args.no_root;

        // fill inp_cns and replace compilation nodes string attributes by numbers
        let file_dependencies = new FileDependencies;
        async.forEachOf( targets, ( target: string, num_target: number, cb: ( boolean ) => void ) => {
            this.env.get_compilation_node( target, this.cwd, file_dependencies, cn => {
                if ( ! cn ) this.send_err( `Error: don't known how to read or build target '${ target }'` );
                this.env.cns[ num_target ] = cn;
                cb( cn == null );
            } );
        }, ( err: boolean ) => {
            if ( err )
                return this._end_comp( true, file_dependencies, [] );

            // start a new build sequence
            const on_wait = nb => this.env.com.note( null, nb > 1 ? `Waiting for another builds to complete (${ nb } tasks)` : `Waiting for another build to complete` );
            const on_launch = () => this.env.com.note( null, `Launching build` );
            
            this.proc.start_new_build_seq( on_wait, on_launch, done_cb => {
                // compilation of input CompilationNodes
                async.forEach( this.env.cns, ( cn: CompilationNode, cb_comp ) => {
                    this.proc.make( this.env, cn, cb_comp );
                }, ( err: boolean ) => {
                    if ( err ) {
                        this._end_comp( err, file_dependencies, this.env.cns );
                        done_cb();
                    } else {
                        // get mission node
                        this.env.get_mission_node( file_dependencies, mission_node => {
                            if ( ! mission_node ) {
                                this.send_err( `Error: don't known what to do for args ${ JSON.stringify( this.env.args ) }` );
                                this._end_comp( true, file_dependencies, this.env.cns );
                                return done_cb();
                            }
                            // compilation if mission node
                            this.proc.make( this.env, mission_node, err => {
                                this._end_comp( err, mission_node.file_dependencies, [ mission_node ] );
                                done_cb();
                            } );
                        } );
                    }
                } );
            } );
        } );
    }

    /** function to be called if interruption (ex: ctrl-c) */
    interrupt() {
        for( const watcher of this.to_be_watched.values() )
            watcher.close();
        this.env.com.active = false;
        this.proc.stop_tasks_from( this.env.com );
    }

    /** */
    _end_comp( err: boolean, file_dependencies: FileDependencies, cns: Array<CompilationNode> ) {
        // no connection with the client => we can stop here
        if ( ! this.env.com.active )
            return;

        // no watch => say that we're done, return
        if ( ! this.env.args.watch ) {
            this.send_end( err ? 1 : 0 );
            this.env.com.active = false;
            return;
        }

        // else (watch mode), update file_dependencies
        for( const cn of cns )
            file_dependencies.merge( cn.file_dependencies );

        // test if something has changed (no need to install watchers if we know that a rebuild is needed)
        file_dependencies.test( has_change => {
            if ( has_change )
                return this._launch();
            // no change => install watchers. 1: find existing directories in parents of not found files
            file_dependencies.get_to_be_watched( watcher_list => {
                for( const name of watcher_list )
                    this.to_be_watched.set( name, fs.watch( name, () => this._relaunch_test( file_dependencies ) ) );
            } );
        } );
    }

    /** test if a launch is needed. If it's */
    _relaunch_test( file_dependencies: FileDependencies ) {
        if ( this.in_a_rel_test )
            return;
        this.in_a_rel_test = true;

        // test if something has changed. If it's not the case, we keep the watchers as it is
        file_dependencies.test( has_change => {
            this.in_a_rel_test = false;
            if ( ! has_change ) 
                return;
            // unwatch all
            this.to_be_watched.forEach( watcher => watcher.close() );
            this.to_be_watched.clear();
            // relaunch
            this._launch();
        } );
    }

    c             : net.Socket;
    proc          : Processor;
    cwd           : string;
    nb_columns    : number;
    siTTY         : boolean;                        /** stdin is a TTY */
    soTTY         : boolean;                        /** stdout is a TTY */
    argv          : Array<string>;
    env           = null as CompilationEnvironment;
    firt_time     = false;
    to_be_watched = new Map<string,fs.FSWatcher>();
    in_a_rel_test = false;                          /** in a relaunch test */
}
