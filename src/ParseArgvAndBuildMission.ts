import CommunicationEnvironment from "./CommunicationEnvironment"
import CompilationEnvironment,
     { CompilationPlugins }     from "./CompilationEnvironment"
import FileDependencies         from "./FileDependencies"
import CompilationNode          from "./CompilationNode"
import ArgumentParser           from './ArgumentParser'
import { SystemInfo }           from "./SystemInfo"
import Processor                from "./Processor"
import SpRepr                   from "./SpRepr"
import * as rimraf              from 'rimraf'
import * as async               from 'async'
import * as path                from 'path'
import * as net                 from 'net'
import * as fs                  from 'fs'

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

    /** function to be called if interruption (ex: ctrl-c) */
    kill() {
        this.killed = true;
        this.env.com.info( null, "Killing processes" );
        for( const watcher of this.to_be_watched.values() )
            watcher.close();
        if ( this.proc.building )
            this.proc.stop_tasks_from( this.env.com );
        else
            this.send_end( 1 );
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
        try {
            if ( typeof code == "string" ) {
                this.send_err( code );
                return this.send_end( 1 );
            }
            this.c.end( `X ${ code.toString() }\n` );
        } catch( e ) {
        }
    }

    /** */
    _launch(): void {
        // define common argument types (mission independant)
        var p = new ArgumentParser( path.basename( this.argv[ 0 ] ), 'an hopefully less dummy build system', '0.0.1' );
        p.add_argument( [], [], 'v,version'        , 'get version number'                                                                       , 'boolean' );
        p.add_argument( [], [], 'w,watch'          , 'watch files, reconstruct dependencies if changed'                                         , 'boolean' );
        p.add_argument( [], [], 'W,watch-all'      , 'call build periodically (watch mode that relaunch execution)'                             , 'boolean' );
        p.add_argument( [], [], 'config-dir'       , "specify the configuration directory (default: '~/.nsmake')"                               , "path"    );
        p.add_argument( [], [], 'inotify'          , 'if -w or --watch, watch using inotify or equivalent (unsafe but consumes less ressources)', 'boolean' );
        p.add_argument( [], [], 'watch-delay'      , 'if -w or --watch and method==polling, delay between tests, in ms'                                     );
        p.add_argument( [], [], 'no-root'          , 'Automatically refuse root/admin installations'                                            , 'boolean' );
        p.add_argument( [], [], 'current-build-seq', 'Do not wait for the previous to be completed'                                             , 'boolean' );

        // make a new environment
        this.env = new CompilationEnvironment( new CommunicationEnvironment( this.c, this.proc, this.nb_columns, this.siTTY, this.soTTY, this.cwd ), this.cwd );
        this.env.decl_additional_options( p );

        // read arguments from the command line. args will contain number where CompilationNode are expected (numbers are indices to targets)
        let targets = new Array<string>();
        p.parse_args( this.env.args, targets, this.argv.slice( 1 ), this.cwd );

        // Handling of trivial flags.
        if ( this.env.args.version              ) { this.send_out( `${ p.prg_name } version: ${ p.version }` );                                      }
        if ( this.env.args._error               ) { this.send_end( this.env.args._msg );                                                     return; }
        if ( this.env.args.help                 ) { this.send_out( p.format_help( this.env.args, this.nb_columns ) );    this.send_end( 0 ); return; }
        if ( ! this.env.args.mission            ) { this.send_end( 'Please define a mission' );                                              return; }
        if ( this.env.args.mission == "help"    ) { this.send_out( p.format_help( this.env.args, this.nb_columns ) );    this.send_end( 0 ); return; }
        if ( this.env.args.mission == "status"  ) { this.send_out( this.proc.status( this.env.args, this.nb_columns ) ); this.send_end( 0 ); return; }
        if ( this.env.args.mission == "clean"   ) { this.send_out( `Cleaning all the build files for directory ${ this.cwd }` );
                                                    this.proc.clean( this.cwd, err => this.send_end( 0 ) );                                  return; }
        if ( this.env.args.mission == "stop"    ) { process.exit( 0 );                                                                               }

        if ( this.env.args.mission == "prerequ" )
            return async.forEach( this.env.args.prerequs, ( req: string, cb_async ) => this.proc._check_prerequ( this.env.com, null, req, cb_async ), err => this.send_end( err ? 1 : 0 ) );


        // com environment
        this.env.com.no_root = this.env.args.no_root;

        // when proc is ready
        let file_dependencies = new FileDependencies;
        const compilation = ( done_cb, plugins_allowed = true ) => {
            // plugins
            if ( plugins_allowed && ! this.env.plugins ) {
                let plugin_path = path.resolve( this.cwd, "nsmake", "plugins", "generators" );
                return fs.readdir( plugin_path, ( err, files ) => {
                    this.env.plugins = new CompilationPlugins;
                    async.forEach( err ? [] : files, ( file, cb ) => {
                        let plugin_env = new CompilationEnvironment( this.env.com, this.cwd );
                        const target = path.resolve( plugin_path, file );
                        plugin_env.get_compilation_node( target, this.cwd, file_dependencies, cn => {
                            if ( ! cn ) {
                                this.send_err( `Error: don't known how to read or build target '${ target }'` );
                                return cb( null );
                            }
                            plugin_env.args.entry_point = 0;
                            plugin_env.args.mission = "exe";
                            plugin_env.cns[ 0 ] = cn;

                            // compilation of target
                            this.proc.make( plugin_env, cn, err => {
                                if ( err )
                                    return cb( null );
                                // get mission node
                                plugin_env.get_mission_node( file_dependencies, mission_node => {
                                    if ( ! mission_node ) {
                                        this.send_err( `Error: don't known what to do for args ${ JSON.stringify( plugin_env.args ) } and cns=[${ plugin_env.cns.map( x => x.pretty ) }]` );
                                        return cb( null );
                                    }
                                    // compilation of mission node
                                    this.proc.make( plugin_env, mission_node, err => {
                                        let cf = mission_node.outputs[ 0 ];
                                        try {
                                            let G = require( cf ).default;
                                            G.src = cf;
                                            this.env.add_generator( G );
                                        } catch ( e ) {
                                            this.send_err( `Problem with plugin ${ cf }: ${ e }\n${ e.stack }` );
                                        }
                                        return cb( null );
                                    } );
                                } );
                            } );
                        } );
                    }, err => {
                        compilation( done_cb, false );
                    } )
                } );
            }

            // fill inp_cns and replace compilation nodes string attributes by numbers
            async.forEachOf( targets, ( target: string, num_target: number, cb: ( boolean ) => void ) => {
                this.env.get_compilation_node( target, this.cwd, file_dependencies, cn => {
                    if ( ! cn ) this.send_err( `Error: don't known how to read or build target '${ target }'` );
                    this.env.cns[ num_target ] = cn;
                    cb( cn == null );
                } );
            }, ( err: boolean ) => {
                if ( err )
                    return this._end_comp( true, file_dependencies, [] );

                // compilation of input CompilationNodes
                async.forEach( this.env.cns, ( cn: CompilationNode, cb_comp ) => {
                    this.proc.make( this.env, cn, cb_comp );
                }, ( err: boolean ) => {
                    if ( err ) {
                        this._end_comp( err, file_dependencies, this.env.cns );
                        return done_cb();
                    } 
                    // get mission node
                    this.env.get_mission_node( file_dependencies, mission_node => {
                        if ( ! mission_node ) {
                            this.send_err( `Error: don't known what to do for args ${ JSON.stringify( this.env.args ) } and cns=[${ this.env.cns.map( x => x.pretty ) }]` );
                            this._end_comp( true, file_dependencies, this.env.cns );
                            return done_cb();
                        }

                        this.proc.make( this.env, mission_node, err => {
                            this._end_comp( err, mission_node.file_dependencies, [ mission_node ] );
                            return done_cb();
                        } );
                    } );
                } );
            } );
        };

        // do it in the current build sequence ?
        if ( this.env.args.current_build_seq )
            return compilation( () => {} );

        // start a new build sequence
        const on_wait = nb => this.env.com.note( null, nb > 1 ? `Waiting for another builds to complete (${ nb } tasks)` : `Waiting for another build to complete` );
        const on_launch = () => this.env.com.note( null, `Launching build` );
        this.proc.start_new_build_seq( on_wait, on_launch, compilation );
    }


    /** */
    _end_comp( err: boolean, file_dependencies: FileDependencies, cns: Array<CompilationNode> ) {
        // no connection with the client => we can stop here
        if ( ! this.env.com.active )
            return;

        // no watch => say that we're done, return
        if ( ! this.env.args.watch && ! this.env.args.watch_all ) {
            this.send_end( err ? 1 : 0 );
            this.env.com.active = false;
            return;
        }

        //
        if ( this.env.args.watch_all )
            return setTimeout( () => this._launch(), this.env.args.watch_delay || 0.5 );

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

    c             : net.Socket;                     /** connection to the client */
    proc          : Processor;
    cwd           : string;                         /** current working directory */
    nb_columns    : number;                         /** in the output terminal */
    siTTY         : boolean;                        /** stdin is a TTY */
    soTTY         : boolean;                        /** stdout is a TTY */
    argv          : Array<string>;
    env           = null as CompilationEnvironment;
    killed        = false;
    to_be_watched = new Map<string,fs.FSWatcher>();
    in_a_rel_test = false;                          /** in a relaunch test */
}
