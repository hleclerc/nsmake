import CommunicationEnvironment from "./CommunicationEnvironment"
import CompilationEnvironment   from "./CompilationEnvironment"
import FileDependencies         from "./FileDependencies"
import CompilationNode          from "./CompilationNode"
import RandNameSuffix           from "./RandNameSuffix"
import { SystemInfo,
        is_compatible_with }    from "./SystemInfo"
import { pu }                   from "./ArrayUtil"
import { mkdir_rec,
         mkdir_rec_sync }       from "./mkdir_rec"
import Service                  from "./Service"
import SpRepr                   from "./SpRepr"
import Pool                     from "./Pool"
import Db                       from "./Db"
import * as child_process       from 'child_process'
import * as yaml                from "js-yaml"
import * as lodash              from 'lodash'
import * as rimraf              from 'rimraf'
import * as async               from 'async'
import * as path                from 'path'
import * as os                  from 'os' // cpus()
import * as fs                  from 'fs'

interface DataInDb {
    outputs            : Array<string>;
    output_mtimes      : Array<number>;
    exe_data           : any;
    generated          : Array<string>;
    generated_mtimes   : Array<number>;
    failed             : Array<string>;
    found              : Array<[string,number]>;
}

export default
class Processor {
    constructor( nsmake_dir: string, system_info: SystemInfo, build_dir = path.resolve( nsmake_dir, "build" ) ) {
        this.system_info = system_info;
        this.nsmake_dir  = nsmake_dir;
        this.build_dir   = build_dir;

        // directories that are needed througout all the process
        mkdir_rec_sync( this.build_dir );

        // database
        this.db = new Db( this.build_dir );

        // launch a first set of idle services
        // for( let i = 0; i < this.jobs; ++i )
        //     this._make_new_service( i );
    }

    /** call cb when ready for a new build sequence */
    start_new_build_seq( waiting_cb: ( number ) => void, at_launch_cb: () => void, cb: ( done_cb: () => void ) => void ): void {
        if ( this.building )
            return waiting_cb( this.waiting_build_seqs.push({ at_launch_cb, cb }) );

        this.building = true;
        this.num_build += 1;
        cb( () => {
            this.building = false;
            if ( this.waiting_build_seqs.length ) {
                const item = this.waiting_build_seqs.shift();
                item.at_launch_cb();
                this.start_new_build_seq( null, null, item.cb );
            }
        } );
    }
    
    /** launch `cn`. When done, call `done_cb` */
    make( env: CompilationEnvironment, cn: CompilationNode, done_cb: ( err: boolean ) => void ): void {
        // if ( cn.type != "Id" )
        //     console.log( cn.pretty, env == null, cn == null, cn.num_build_done == this.num_build, cn.num_build_seen == this.num_build );

        // late answer for a killed service...
        if ( env == null || cn == null )
            return;

        // if already done in this session, execute the callback with the obtained result.
        if ( cn.num_build_done == this.num_build )
            return done_cb( null );

        // if already seen but not done, it means that cn is going to be processed. We will then call done_cb.
        if ( cn.num_build_seen == this.num_build ) {
            cn.done_cbs.push( done_cb );
            return;
        }
        cn.num_build_seen = this.num_build;
        cn.done_cbs = [ done_cb ];

        //
        async.forEach( cn.children, ( ch, cb: ( err: boolean ) => void ) => {
            this.make( env, ch, cb );
        }, err => {
            this._visit( env, cn, err ); // will use items of cn.done_cb
        } );
    }

    /** service working on env are restarted. Waiting launches are removed */
    stop_tasks_from( com: CommunicationEnvironment ): void {
        // kill and restart
        for( let i = 0; i < this.services.length; ++i ) {
            if ( this.services[ i ].env && this.services[ i ].env.com == com ) {
//                try { ( this.services[ i ].cp.stdin as any ).pause(); } catch ( e ) {}
                this.services[ i ].cp.kill();
                this.services[ i ].cp = null;
                this.services.splice( i--, 1 );
           }
        }

        // rm waiting services
        this.waiting_cns = this.waiting_cns.filter( ws => {
            if ( ws.env == null || ws.env.com != com )
                return true;
            this._done( ws.env, ws.cn, true );
            return false;
        } );

        //
        let ids_to_del = new Array<string>();
        this.waiting_spw.forEach( ( sd, id ) => {
            if ( sd.com == com )
                ids_to_del.push( id );
        } );
        for( const id of ids_to_del )
            this.waiting_spw.delete( id );
    }

    kill_all(): void {
        // kill and do not restart
        for( let i = 0; i < this.services.length; ++i ) {
            if ( this.services[ i ].cp ) {
                try { ( this.services[ i ].cp.stdin as any ).pause(); } catch ( e ) {}
                this.services[ i ].cp.kill(); // won't be restarted
                this.services[ i ].cp = null;
                this.services.splice( i--, 1 );
            }
        }

        // rm waiting services
        this.waiting_cns.forEach( ws => this._done( ws.env, ws.cn, true ) )
        this.waiting_cns.length = 0;
    }

    clean( dir: string, cb: ( err: Error ) => void ): void {
        // find all the cmd files "concerned" by the directory
        let lst = [];
        this.db.remove( ( key: string, val: string ): boolean => {
            if ( val.indexOf( dir ) >= 0 ) {
                try {
                    lst.push( ...JSON.parse( val ).generated );
                } catch ( e ) {
                    console.error( e );
                }
                return true;
            }
            return false;
        }, err => {
            async.forEach( lst, rimraf, cb );
        } );

        // //
        // this.db.clean( () => {
        //     rimraf( this.build_dir, err => {
        //         if ( err ) return cb( err );
        //         mkdir_rec_sync( this.build_dir );
        //         this.db.init();
        //         cb( null );
        //     } );
        // } );
    }

    _done( env: CompilationEnvironment, cn: CompilationNode, err = false ): void {
        // stuff to be made, error ot not
        function merge_ch_info( ch: CompilationNode ) {
            cn.idempotent = cn.idempotent && ch.idempotent;
            cn.file_dependencies.merge( ch.file_dependencies );
        }
        cn.children           .forEach( merge_ch_info );
        cn.additional_children.forEach( merge_ch_info );

        // if error => cleansing
        if ( err ) {
            return async.forEach( cn.generated, ( name, cb ) => rimraf( name, err => cb( null ) ), rimraf_err => {
                cn.outputs.length = 0;
                cn.generated.length = 0;
                this._exec_done_cb( env.com, cn, err );
            } );
        }

        // timing
        if ( env.verbose >= 2 && cn.type != "Id" ) {
            let t = process.hrtime( cn.start );
            env.com.note( cn, `Execution of ${ cn.pretty }: ${ t[ 0 ] + t[ 1 ] / 1e9 }` );
        }

        // outputs mtimes
        async.forEachOf( cn.type != "Id" ? cn.outputs : [], ( output: string, num_output: number, callback ) => {
            fs.stat( output, ( err, stat ) => {
                if ( err ) {
                    env.com.error( cn, `Output ${ output } does not exist (after execution of ${ cn.pretty }).` );
                    return callback( true );
                }
                cn.output_mtimes[ num_output ] = stat.mtime.getTime();
                callback( false );
            } );
        }, ( err ) => {
            if ( err )
                return this._done( env, cn, true );

            // generated mtimes
            async.forEachOf( cn.generated, ( output: string, num_output: number, callback ) => {
                fs.stat( output, ( err, stat ) => {
                    if ( err ) {
                        env.com.error( cn, `Generated (should be) ${ output } does not exist (after execution of ${ cn.pretty }).` );
                        return callback( true );
                    }
                    cn.generated_mtimes[ num_output ] = stat.mtime.getTime();
                    callback( false );
                } );
            }, ( err ) => {
                if ( err )
                    return this._done( env, cn, true );

                // save in db (we don't have wait for a complete save)
                if ( cn.idempotent && cn.type != "Id" ) {
                    this.db.put( cn.signature, JSON.stringify( {
                        outputs               : cn.outputs,
                        output_mtimes         : cn.output_mtimes,
                        exe_data              : cn.exe_data,
                        generated             : cn.generated,
                        generated_mtimes      : cn.generated_mtimes,
                        failed                : [ ...cn.file_dependencies.failed ],
                        found                 : [ ...cn.file_dependencies.found.keys() ].map( name => [ name, cn.file_dependencies.found.get( name ) ] ),
                    } as DataInDb ), err => {
                        console.assert( ! err, "TODO: db put error" );
                    } );
                }

                // we're not going to write more stuff about this node
                this._exec_done_cb( env.com, cn, false );
            } );
        });
    }

    /** each nodes are visited once for each `make`, either they are already done or not */
    _visit( env: CompilationEnvironment, cn: CompilationNode, err: boolean ): void {
        // if we had an error, nothing to launch or save
        if ( err )
            return this._exec_done_cb( env.com, cn, err );

        // if has to be re-executed each time, we do not have to make tests
        if ( cn.type == "Id" || ! cn.idempotent || cn.build_error )
            return this._launch( env, cn );

        // launched at least once (i.e. data is in memory) ?
        if ( cn.num_build_exec )
            return this._test_if_done_for_this_build( env, cn );

        // else, we try to download data from db
        this.db.get( cn.signature, ( err, value: string ) => {
            // was not in db ?
            if ( err ) {
                if ( ! err.notFound )
                    env.com.error( cn, `Error while trying to get key ${ cn.signature } in db: ${ err }` );
                return this._launch( env, cn );
            }

            // else, get data from the db
            try {
                const json_data = JSON.parse( value ) as DataInDb;

                cn.outputs                  = json_data.outputs;
                cn.output_mtimes            = json_data.output_mtimes;
                cn.exe_data                 = json_data.exe_data;
                cn.generated                = json_data.generated;
                cn.generated_mtimes         = json_data.generated_mtimes;
                cn.file_dependencies.failed = new Set<string>( json_data.failed );
                cn.file_dependencies.found  = new Map<string,number>( json_data.found );

                // and continue
                this._test_if_done_for_this_build( env, cn );
            } catch ( e ) {
                this._launch( env, cn );
            }
        } );
    }

    _test_if_done_for_this_build( env: CompilationEnvironment, cn: CompilationNode ): void {
        let _ko = ( msg: string ) => {
            if ( env.verbose )
                env.com.note( cn, `  Update of ${ cn.pretty }. Reason: ${ msg }` );
            this._launch( env, cn );
        };

        // test for_found.failed
        async.forEach( [ ...cn.file_dependencies.failed.keys() ], ( name: string, cb: ( err: string ) => void ) => {
            fs.exists( name, exists => cb( exists ? `now, file '${ name }' exists (that was not the case before)` : '' ) );
        }, ( err ) => {
            if ( err )
                return _ko( err );

            // test for_found.found
            async.forEach( [ ...cn.file_dependencies.found.keys() ], ( name: string, cb: ( err: string ) => void ) => {
                fs.stat( name, ( err, stats ) => {
                    if ( err ) return cb( `file '${ name }' does not exist anymore` );
                    cb( stats.mtime.getTime() != cn.file_dependencies.found.get( name ) ? `file '${ name }' has changed` : '' );
                } );
            }, ( err ) => {
                if ( err )
                    return _ko( err );

                // test output mtime
                async.forEachOf( cn.outputs, ( name: string, index: number, cb: ( err: string ) => void ) => {
                    fs.stat( name, ( err, stats ) => {
                        if ( err ) return cb( `output file '${ name }' does not exist anymore` );
                        cb( stats.mtime.getTime() != cn.output_mtimes[ index ] ? `Error: file '${ name }' has been modified outside of nsmake. Nsmake will not take the initiative to change the content (you can delete it if you want nsmake to generate it again)` : null );
                    } );
                }, ( err ) => {
                    if ( err )
                        return _ko( err );

                    // everything seems to be ok :)
                    this._exec_done_cb( env.com, cn, false );
                } );

            } );

        } );
    }

    _exec_done_cb( com: CommunicationEnvironment, cn: CompilationNode, err: boolean ): void {
        cn.num_build_done = this.num_build;
        cn.build_error    = err;

        let done_cbs = [ ...cn.done_cbs ];
        cn.done_cbs.length = 0;

        done_cbs.forEach( cb => cb( err ) );
        com.close_channel( cn );
    }

    /** Do execution of cn */
    _launch( env: CompilationEnvironment, cn: CompilationNode ): void {
        // particular case
        if ( cn.type == "Id" ) {
            return fs.stat( cn.args.target, ( err, stats ) => {
                if ( err ) { env.com.error( cn, err.toString() ); return this._done( env, cn, true ); }
                cn.file_dependencies.found.set( cn.args.target, stats.mtime.getTime() );
                cn.output_mtimes = [ stats.mtime.getTime() ];
                cn.outputs = [ cn.args.target ];
                this._done( env, cn, false );
            } );
        }
        
        //
        if ( env.verbose ) {
            // function cut( line: string ): string {
            //     if ( env.com.nb_columns == 0 || line.length < env.com.nb_columns )
            //         return line;
            //     let res = line.slice( 0, env.com.nb_columns ), rem = line.slice( env.com.nb_columns ), nc = env.com.nb_columns - 5;
            //     for( ; rem.length > nc; rem = rem.slice( nc ) ) res += "\n  ..." + rem.slice( 0, nc );
            //     return rem.length ? res + "\n  ..." + rem : res;
            // } // cn.pretty.length > env.com.nb_columns - 10 ? cn.pretty.slice( 0, env.com.nb_columns - 13 ) + "..." : cn.pretty 
            env.com.announcement( cn, `Launch of ${ cn.pretty }` );
        }

        // if would lead to too much active service, wait a bit
        if ( this.services.filter( s => s.status == "active" ).length >= this.jobs ) {
            this.waiting_cns.push( { env, cn } );
            return;
        }

        // clear stuff like for_found, additional_children, ...
        cn._init_for_build( err => {
            if ( err ) {
                env.com.error( cn, err );
                return this._done( env, cn, true );
            }

            // kind of service
            const ind_at = cn.type.indexOf( "@" );
            const category = ind_at >= 0 ? cn.type.slice( ind_at + 1 ) : null;

            // launch in a free service
            const use_service = ( service: Service ) => {
                if ( ! service )
                    return this._done( env, cn, true );

                service.status = "active";
                service.env    = env;
                service.cn     = cn;

                service.send( JSON.stringify( {
                    action    : "task",
                    type      : ind_at >= 0 ? cn.type.slice( 0, ind_at ) : cn.type,
                    signature : cn.signature,
                    nb_columns: env.com.nb_columns || 120,
                    children  : cn.children.map( ch => ( { signature: ch.signature, outputs: ch.outputs, exe_data: ch.exe_data } ) ),
                    args      : cn.args
                } ) + `\n` );
            };

            const service = this.services.find( s => s.status == "idle" && category == s.category );
            if ( service )
                use_service( service );
            else
                this._make_new_service( this.services.length, use_service, category, env.com );
        } );
    }

    _launch_waiting_cn_if_possible() {
        if ( this.waiting_cns.length && this.services.filter( s => s.status == "active" ).length < this.jobs ) {
            let item = this.waiting_cns.shift();
            this._launch( item.env, item.cn );
        }
    }

    _make_new_service( pos = this.services.length, service_cb: ( service: Service ) => void, category = null as string, com = null as CommunicationEnvironment ): void {
        // what to do when we have the child process
        const init_cp = ( cp: child_process.ChildProcess, force_stdin: boolean ) => {
            if ( ! cp )
                return service_cb( null );

            let service = new Service;
            service.send = force_stdin ?
                ( data: string ) => { if ( service.cp ) service.cp.stdin.write( data ); } : 
                ( data: string ) => { if ( service.cp ) service.cp.send( data ); };
            service.category = category;
            service.cp = cp;

            this.services[ pos ] = service;

            let lines = "";
            const on_message = ( data: Buffer ) => {
                lines += data.toString();
                const index_lf = lines.lastIndexOf( "\n" );
                if ( index_lf >= 0 ) {
                    for( const line of lines.slice( 0, index_lf ).split( "\n" ) ) {
                        try {
                            this._action_from_service( service, JSON.parse( line ) );
                        } catch( e ) {
                            console.error( e );
                            if ( service.env )
                                service.env.com.error( service.cn, `Error: while parsing '${ line }' for '${ service.cn.pretty }': ${ e.toString() }. => Service is going to be killed (see server.log for full stack)` );
                            if ( service.cp ) {
                                try { ( service.cp.stdin as any ).pause(); } catch ( e ) {}
                                service.cp.kill();
                                service.cp = null;
                            }
                        }
                    }
                    lines = lines.slice( index_lf + 1 );
                }
            };

            if ( force_stdin ) {
                service.cp.stdout.on( 'data', on_message );
                service.cp.stderr.on( 'data', data => { if ( service.env ) service.env.com.error( service.cn, data.toString(), false ); } );
            } else
                service.cp.on( 'message', on_message );

            service.cp.on( 'exit', ( code: number, signal: string ) => {
                if ( signal && service.env )
                    service.env.com.error( service.cn, `Service${ category ? " " + category : "" } ended with signal ${ signal }` );
                // setTimeout( () => this._action_from_service( service, null ), 5000 ); // this is ugly... but tools continue to produce content after exit
                this._action_from_service( service, null );
            } );

            service.cp.on( 'error', err => {
                this._action_from_service( service, null );
            } );

            service_cb( service );
        };

        if ( category )
            this._make_child_process_for_category( category, com, init_cp );
        else
            init_cp( child_process.spawn( process.argv[ 0 ], [ `--debug=${ 7000 + Processor.cpt_debug_service++ }`, path.resolve( __dirname, "main_js_services.js" ) ], { stdio: [ 'pipe', 1, 2, 'ipc' ] } as any ), false );
        // init_cp( child_process.fork( path.resolve( __dirname, "main_js_services.js" ), [], { stdio: [ 'pipe', 1, 2, 'ipc' ] } as any ), false );
    }
    static cpt_debug_service = 0;

    _action_from_service( service: Service, cmd: { action: string, msg_id: string, args: any } ): void {
        // helper: answer to a service command
        const ans = ( err: boolean, res = null ) => {
            service.send( JSON.stringify( { msg_id: cmd.msg_id, err, res } ) + "\n" );
        };

        // helper: display an error message
        const msg = ( str: string ) => {
            if ( service.env )
                service.env.com.error( service.cn, str );
        };

        // helper: called when the service has finished
        const done = ( err: boolean ) => {
            if ( service.cn ) {
                this._done( service.env, service.cn, err );
                service.status = "idle";
                service.env    = null;
                service.cn     = null;
                this._launch_waiting_cn_if_possible();
            }
        };

        // particular case: cmd == null means error
        if ( cmd == null )
            return done( true );
        
        //
        const spl_act = cmd.action.split( ":" );
        switch ( spl_act[ 0 ] ) {
            // display
            case "announcement": if ( service.env ) service.env.com.announcement( service.cn, cmd.args.msg ); else console.error( cmd.args.msg ); return;
            case "note"        : if ( service.env ) service.env.com.note        ( service.cn, cmd.args.msg ); else console.error( cmd.args.msg ); return;
            case "info"        : if ( service.env ) service.env.com.info        ( service.cn, cmd.args.msg ); else console.error( cmd.args.msg ); return;
            case "error"       : if ( service.env ) service.env.com.error       ( service.cn, cmd.args.msg ); else console.error( cmd.args.msg ); return;

            // actions
            case "done":
                // save result in local memory
                if ( cmd.args.output_summary ) {
                    pu( service.cn.generated, ...( cmd.args.output_summary.generated || [] ) );
                    service.cn.outputs       = cmd.args.output_summary.outputs || [];
                    service.cn.exe_data      = cmd.args.output_summary.exe_data || {};
                    service.cn.idempotent    = cmd.args.output_summary.idempotent || false;
                }
                // the service is now idle and not linked to a specific env or cn
                return done( cmd.args.err );

            case "get_filtered_target":
                return service.env.get_compilation_node( cmd.args.target, cmd.args.cwd, service.cn.file_dependencies, ncn => {
                    if ( ncn ) {
                        service.status = "waiting";
                        this.make( service.env, ncn, err => {
                            service.status = "active";
                            if ( err )
                                return ans( true );
                            if ( service.cn )
                                service.cn.additional_children.push( ncn );
                            ans( false, { name: ncn.outputs[ 0 ], signature: ncn.signature } );
                        } );
                    } else {
                        ans( false, null );
                    }
                } );

            case "get_filtered_target_signature":
                return service.env.get_compilation_node( cmd.args.target, cmd.args.cwd, service.cn.file_dependencies, ncn => {
                    ans( false, ncn ? ncn.signature : null );
                } );

            case "get_filtered_target_signatures":
                return async.map( cmd.args.targets, ( target: string, cb ) => {
                    if ( ! service.env )
                        return cb( true, null );
                    service.env.get_compilation_node( target, cmd.args.cwd, service.cn.file_dependencies, ncn => {
                        cb( null, ncn ? ncn.signature : null );
                    }, cmd.args.care_about_target );
                }, ( err, signatures ) => {
                    ans( false, signatures );
                } );

            case "get_first_filtered_target_signature": {
                let num = -1;
                return async.forEachSeries( cmd.args.targets, ( target: string, cb: ( err: CompilationNode ) => void ) => {
                    if ( ! service.env )
                        return cb( null );
                    service.env.get_compilation_node( target, cmd.args.cwd, service.cn.file_dependencies, ncn => {
                        ++num;
                        cb( ncn );
                    }, false, cmd.args.allow_generation );
                }, ncn => {
                    ans( false, ncn ? { signature: ncn.signature, num } : null );
                } );
            }

            case "get_cn_data": {
                let ncn = service.env.com.proc.pool.factory( cmd.args.signature );
                service.status = "waiting";
                return this.make( service.env, ncn, err => {
                    service.status = "active";
                    if ( err )
                        return ans( true );
                    if ( service.cn )
                        service.cn.additional_children.push( ncn );
                    ans( err, err ? null : { signature: ncn.signature, outputs: ncn.outputs, exe_data: ncn.exe_data } );
                } );
            }

            case "get_cns_data":
                service.status = "waiting";
                return async.map( cmd.args.lst, ( sgn: string, cb: ( err: boolean, cn: CompilationNode ) => void ) => {
                    if ( ! service.env )
                        return cb( true, null );
                    if ( sgn ) {
                        const ncn = service.env.com.proc.pool.factory( sgn );
                        this.make( service.env, ncn, err => {
                            if ( service.cn )
                                service.cn.additional_children.push( ncn );
                            cb( err, ncn );
                        } );
                    } else
                        cb( false, null );
                }, ( err, ncns ) => {
                    service.status = "active";
                    ans( err, err ? null : ncns.map( cn => ({
                        signature: cn ? cn.signature : null, outputs: cn ? cn.outputs : [], exe_data: cn ? cn.exe_data : {}
                    }) ) );
                } );

            case "register_aliases":
                return service.env.register_aliases( service.cn, cmd.args.lst );

            case "append_to_env_var":
                return service.env.append_to_env_var( cmd.args.env_var, cmd.args.value );

            case "run_mission_node":
                service.status = "waiting";
                return async.map( cmd.args.signatures, ( signature: string, cb ) => {
                    if ( ! service.env )
                        return cb( true, null );
                    const ncn = this.pool.factory( signature ); 
                    this.make( service.env, ncn, err => {
                        if ( service.cn )
                            service.cn.additional_children.push( ncn );
                        cb( err, ncn );
                    } );
                }, ( err, inp_cns: Array<CompilationNode> ) => {
                    service.status = "active";
                    if ( err || ! service.env )
                        return ans( true );
                    let nce = service.env.make_child( cmd.args.args, inp_cns );
                    nce.get_mission_node( service.cn ? service.cn.file_dependencies : new FileDependencies, ncn => {
                        if ( ! ncn )
                            return ans( true );
                        service.status = "waiting";
                        this.make( nce, ncn, err => {
                            service.status = "active";
                            if ( err )
                                return ans( true ); 
                            if ( service.cn )
                                service.cn.additional_children.push( ncn );
                            ans( false, { outputs: ncn.outputs, signature: ncn.signature, exe_data: ncn.exe_data } );
                        } );
                    } );
                } );

            case "new_build_file":
                return this.new_build_file( service.env.cwd, cmd.args.orig, cmd.args.ext, cmd.args.dist, ( err, name ) => {
                    if ( err ) {
                        if ( service.env )
                            service.env.com.error( service.cn, err.toString() ); 
                        return ans( true );
                    }
                    if ( service.cn )
                        service.cn.generated.push( name );
                    ans( false, name );
                } );
                
            case "spawn_local":
                service.status = "active";
                return this._spawn_local( service.env.com, cmd.args.executable, cmd.args.args || [], cmd.args.redirect || "", code => {
                    ans( false, code );
                } );
                
            case "spawn": {
                // display
                service.env.com.announcement( service.cn, [ cmd.args.cmd, ...cmd.args.args ].join( " " ) );
                service.status = "active";

                // execution, with basic redirection
                const cp = child_process.spawn( cmd.args.cmd, cmd.args.args, { cwd: cmd.args.cwd } );
                cp.stdout.on( "data", buffer => service.env.com.info ( service.cn, buffer.toString(), false ) );
                cp.stderr.on( "data", buffer => service.env.com.error( service.cn, buffer.toString(), false ) );
                cp.on( "error", err => { if ( service.env ) service.env.com.error( service.cn, err.toString() ); ans( true, -1 ) } );
                cp.on( "close", ( code, signal ) => ans( false, signal ? -1 : code ) );
                return;
            }

            case "set_status":
                if ( service.status == "active" && cmd.args.status == "waiting" ) {
                    service.status = cmd.args.status;
                    this._launch_waiting_cn_if_possible();
                } else
                    service.status = cmd.args.status;
                return;

            case "run_yaml_install_cmd":
                return this.yaml_install_cmd( service.env.com, service.cn, cmd.args.cwd, cmd.args.rules, cmd.args.system_info || this.system_info, ( err, msg ) => {
                    ans( false, { err, msg } );
                } );

            case "run_install_cmd":
                return this.install_cmd( service.env.com, service.cn, cmd.args.cwd, cmd.args.cmd, cmd.args.prerequ, err => {
                    ans( false, err );
                } );

            case "check_prerequ":
                return this._check_prerequ( service.env.com, service.cn, cmd.args.req, err => {
                    ans( false, err );
                } );

            // default
            default:
                for( const g of service.env.generators )
                    if ( g.constructor.name == spl_act[ 0 ] )
                        return g.msg_from_service( service, spl_act[ 1 ], cmd.args, ans, msg );
                msg( `Unknown service command '${ cmd.action }'. => service is going to be killed` );
                try { ( service.cp.stdin as any ).pause(); } catch ( e ) {}
                service.cp.kill();
                service.cp = null;
        }
    }

    _spawn_local( com: CommunicationEnvironment, executable: string, args: Array<string>, redirect: string, cb: ( code: number ) => void, cwd = com.cwd ) {
        const id = this.waiting_spw.size.toString();
        com.spawn_local( id, executable, args, redirect, cwd );
        this.waiting_spw.set( id, { com, cb: ( code: number ) => {
            this.waiting_spw.delete( id );
            cb( code );
            if ( this.waiting_spw.size )
                throw "TODO !! (_spawn_local)";
        }, cwd } );
    }

    _exec_local( com: CommunicationEnvironment, cmd: string, redirect: string, cb: ( code: number ) => void, cwd = com.cwd ) {
        const id = this.waiting_spw.size.toString();
        com.exec_local( id, cmd, redirect, cwd );
        this.waiting_spw.set( id, { com, cb: ( code: number ) => {
            this.waiting_spw.delete( id );
            if ( this.waiting_spw.size )
                throw "TODO !! (_spawn_local)";
            cb( code );
        }, cwd } );
    }

    /** make child process for a given "category" (which is actually the path of the service entry point) */
    _make_child_process_for_category( category: string, com: CommunicationEnvironment, init_cp: ( cp: child_process.ChildProcess, use_stdio: boolean ) => void ): void {
        // new environment 
        const ep = this.pool.factory( Pool.signature( "Id", [], { target: category } ) );
        let nce = new CompilationEnvironment( com, this.build_dir, {
            mission      : "exe",
            entry_point  : 0,
            cpp_bootstrap: true,
            // verbose      : true,
        }, [ ep ] );

        // make an executable
        this.make( nce, ep, err => {
            if ( err ) return init_cp( null, true );
            nce.get_mission_node( new FileDependencies, ncn => {
                if ( ! ncn ) return init_cp( null, true );
                this.make( nce, ncn, err => {
                   if ( err ) return init_cp( null, true );
                    init_cp( child_process.spawn( ncn.outputs[ 0 ] ), true );
                    // init_cp( child_process.spawn( "valgrind", [ ncn.outputs[ 0 ] ] ), true );
                } );
            } );
        } );
    }

    /**  */
    yaml_install_cmd( com: CommunicationEnvironment, cn: CompilationNode, cwd: string, rules: Array<any>, system_info: SystemInfo, cb: ( err: boolean, msg: string ) => void ) {
        let tried = false;
        async.forEachSeries( rules, ( rule, cb_rule_trial: ( ok: boolean ) => void ) => {
            if ( ! is_compatible_with( system_info, rule.systems ) || ( com.no_root && ( rule.root || rule.admin ) ) )
                return cb_rule_trial( false );
            tried = true;

            // chech sub prerequisites
            return async.forEach( rule.prerequ || [], ( sub_req: string, cb_prerequ ) => {
                this._check_prerequ( com, cn, sub_req, cb_prerequ );
            }, err_prerequ => {
                if ( err_prerequ )
                    return cb_rule_trial( false );

                // command[s]
                const exe_cmd = ( cmd: string | Array<string>, exe_cmd_cb: ( err: boolean ) => void, use_root: boolean, disp = true ) => {
                    if ( rule.shell == "powershell" ) {
                        if ( use_root && ( rule.admin || rule.root ) ) {
                            if ( typeof cmd == "string" )
                                cmd = [ "powershell", "-c", "Start-Process", "powershell.exe", "-Verb", "runAs", "-Argumentlist", cmd, "-Wait" ];
                            else
                                cmd = [ "powershell", "-c", "Start-Process", "powershell.exe", "-Verb", "runAs", "-Argumentlist", cmd.map( x => "'" + x + "'" ).join( "," ), "-Wait" ];
                        } else
                            cmd = [ "powershell", "-c", ...( typeof cmd == "string" ? [ cmd ] : cmd ) ];
                        com.note( cn, JSON.stringify({ cmd, use_root }) )
                    } else if ( use_root && ( rule.admin || rule.root ) ) {
                        // TODO: admin with cmd.exe
                        // const prg = com.siTTY ? "sudo" : "pkexec";
                        const prg = "pkexec";
                        if ( typeof cmd == "string" )
                            cmd = [ prg, "sh", "-c", cmd ];
                        else
                            cmd.unshift( prg );
                    }
                    this.__install_cmd( com, cn, cwd, cmd, exe_cmd_cb, disp );
                };
                const pre_check = ( check_cmd: string | Array<string>, pre_check_cb: ( has: boolean ) => void ) => {
                    if ( ! check_cmd )
                        return pre_check_cb( true );
                    exe_cmd( check_cmd, err => pre_check_cb( ! err ), false, false );
                }
                pre_check( rule.check, has => {
                    if ( ! has ) {
                        if ( rule.commands ) {
                            return async.forEachSeries( rule.commands as Array<string | Array<string>>, ( command: string | Array<string>, 
                                cb_fe: ( err: boolean ) => void ) => exe_cmd( command, cb_fe, rule.admin || rule.root ),
                                err => cb_rule_trial( ! err )
                            );
                        }
                        if ( rule.command )
                            return exe_cmd( rule.command, err => cb_rule_trial( ! err,  ), rule.admin || rule.root );
                    }
                    return cb_rule_trial( true );
                } );
            } );
        }, ok => {
            ok ? cb( false, "" ) : cb( true, tried ? "errors during installation" : `there's no 'load_sets' rule for current system (${ JSON.stringify( system_info ) })` );
        } );
    }

    /** ex of category: npm... */
    install_cmd( com: CommunicationEnvironment, cn: CompilationNode, cwd: string, cmd: Array<string> | string, prerequ: Array<string>, cb: ( err: boolean ) => void ) {
        async.forEach( prerequ, ( req: string, cb_prerequ ) => {
            this._check_prerequ( com, cn, req, cb_prerequ );
        }, ( err_prerequ ) => {
            if ( err_prerequ )
                return cb( true );
            this.__install_cmd( com, cn, cwd, cmd, cb );
        } );
    }

    /** ex of category: npm... */
    __install_cmd( com: CommunicationEnvironment, cn: CompilationNode, cwd: string, cmd: Array<string> | string, cb: ( err: boolean ) => void, disp = true ) {
        const key = cwd;
        if ( this.current_install_cmds.has( key ) )
            return this.waiting_install_cmds.push( { com, cn, cwd, cmd, cb } );
        this.current_install_cmds.add( key );
            
        const cont = () => {
            this.current_install_cmds.delete( key );
            if ( this.waiting_install_cmds.length ) {
                const item = this.waiting_install_cmds.shift();
                this.__install_cmd( item.com, item.cn, item.cwd, item.cmd, item.cb );
            }
        }

        if ( disp )
            com.announcement( cn, typeof cmd == "string" ? cmd : cmd.join( " " ) );
        //
        typeof cmd == "string" ?
            this._exec_local( com, cmd, "", ( code: number ) => { cont(); cb( code != 0 ); }, cwd ) :
            this._spawn_local( com, cmd[ 0 ], cmd.slice( 1 ), "", ( code: number ) => { cont(); cb( code != 0 ); }, cwd );

        // const cp = typeof cmd == "string" ?
        //     child_process.exec( cmd, { cwd } ) : 
        //     child_process.spawn( cmd[ 0 ], cmd.slice( 1 ), { cwd } );
        // cp.stdout.on( "data", buffer => com.info ( cn, buffer.toString(), false ) );
        // cp.stderr.on( "data", buffer => com.error( cn, buffer.toString(), false ) );
        // cp.on( "error", err => { com.error( cn, err.toString() ); cont(); cb( true ); } );
        // cp.on( "close", ( code, signal ) => { cont(); cb( Boolean( code || signal ) ); } );
    }

    _check_prerequ( com: CommunicationEnvironment, cn: CompilationNode, req: string, cb: ( err: boolean ) => void ) {
        // try to find prerequ
        let trials = [
            path.resolve( __dirname, "..", "..", "rules", "prerequ", req + ".yaml" ),
            path.resolve( com.cwd, "nsmake", "rules", "prerequ", req + ".yaml" ),
        ];
        async.forEachSeries( trials, ( trial, cbt ) => {
            fs.readFile( trial, ( err, data ) => cbt( err ? null : { data: data.toString(), name: trial } ) );
        }, ( res: { data: string, name: string } ) => {
            if ( ! res ) {
                com.error( cn, `Prerequisite '${ req }' not found (tried ${ JSON.stringify( trials ) })` );
                return cb( true );
            }
            try {
                this.yaml_install_cmd( com, cn, com.cwd, yaml.load( res.data ), this.system_info, ( err: boolean, msg: string ) => {
                    if ( err ) com.error( cn, `Error in prerequisite file '${ req }': ${ msg }` );
                    cb( err );
                } );
            } catch ( e ) {
                com.error( cn, `error while parsing\n${ res.data } from ${ res.name }:\n` + e.toString() );
                cb( true );
            }
        } );
    }

    _spawn_is_done( id: string, code: number ) {
        const sd = this.waiting_spw.get( id );
        if ( sd )
            sd.cb( code );
    }

    new_build_file( cwd: string, orig: string, ext: string, dist: string, cb: ( err, name ) => void ) {
        const corr = path.normalize( orig.slice( 0, orig.length - path.extname( orig ).length ) || "tmp" );
        const suff = ext || path.extname( orig );
        // orig = /shmurtz/smurf/orig, dist = /shmurtz/dist -> dst = /shmurtz/dist/smurf/orig
        const prop = dist ? path.resolve( dist, orig ? path.relative( cwd, corr ) : corr ) : 
                            path.resolve( this.build_dir, path.basename( corr ) );

        let mp = new RandNameSuffix;
        async.retry( 1000, cb => {
            const name = prop + mp.val() + suff;
            // if dist, we may have to create some directory
            mkdir_rec( dist ? path.dirname( prop ) : null, err => {
                if ( err ) return cb( err, null );
                // test if the file exists
                fs.open( name, "wx", 384 /* 0600 */, ( err, fd ) => {
                    if ( err ) { mp.next(); return cb( err, null ); }
                    fs.close( fd, err => cb( null, name ) );
                } );
            } );
        }, ( err: NodeJS.ErrnoException, name: string ) => {
            cb( err, name );
        } );
    }

    system_info          : SystemInfo;
    nsmake_dir           : string;
    build_dir            : string;
    jobs                 = os.cpus().length;
    pool                 = new Pool();
    num_build            = 0;                    /** incremented each time we launch a new build. We assume that files are not changed during the process */
    db                   : Db;
    services             = new Array<Service>();
    building             = false;
    waiting_cns          = new Array<{ env: CompilationEnvironment, cn: CompilationNode }>();
    waiting_spw          = new Map<string,{ com: CommunicationEnvironment, cb: ( code: number ) => void, cwd: string }>();
    waiting_build_seqs   = new Array<{ at_launch_cb: () => void, cb: ( done_cb: () => void ) => void }>(); 
    current_install_cmds = new Set<string>();
    waiting_install_cmds = new Array< { com: CommunicationEnvironment, cn: CompilationNode, cwd: string, cmd: Array<string> | string, cb: ( err: boolean ) => void } >();
}

