import CommunicationEnvironment from "./CommunicationEnvironment";
import CompilationEnvironment   from "./CompilationEnvironment";
import FileDependencies         from "./FileDependencies";
import CompilationNode          from "./CompilationNode";
import { mkdir_rec,
         mkdir_rec_sync }       from "./mkdir_rec";
import SpRepr                   from "./SpRepr";
import Pool                     from "./Pool";
import Db                       from "./Db";
import * as child_process       from 'child_process';
import * as lodash              from 'lodash';
import * as crypto              from 'crypto';
import * as rimraf              from 'rimraf';
import * as async               from 'async';
import * as path                from 'path';
import * as os                  from 'os'; // cpus()
import * as fs                  from 'fs';
            
export class Service {
    want_restart = true;
    status       = "idle" as "idle" | "waiting" | "active";
    category     = null as string;                          /** if non null, name of the entry point for the service */
    send         : ( data: string ) => void;                /** function to send data to the child process */
    cp           = null as child_process.ChildProcess;
    env          = null as CompilationEnvironment;
    cn           = null as CompilationNode;
}

interface DataInDb {
    outputs            : Array<string>;
    output_mtimes      : Array<number>;
    exe_data           : any;
    generated          : Array<string>;
    failed             : Array<string>;
    found              : Array<[string,number]>;
}

export default
class Processor {
    constructor( nsmake_dir: string, build_dir = path.resolve( nsmake_dir, "build" ) ) {
        this.nsmake_dir = nsmake_dir;
        this.build_dir  = build_dir;

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
                this.services[ i ].cp.kill(); // will be restarted
                this.services[ i ].cp = null;
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
            if ( sd.env && sd.env.com == com )
                ids_to_del.push( id );
        } );
        for( const id of ids_to_del )
            this.waiting_spw.delete( id );
    }

    kill_all(): void {
        // kill and do not restart
        for( let i = 0; i < this.services.length; ++i ) {
            this.services[ i ].want_restart = false;
            if ( this.services[ i ].cp ) {
                this.services[ i ].cp.kill(); // won't be restarted
                this.services[ i ].cp = null;
            }
        }

        // rm waiting services
        this.waiting_cns.forEach( ws => this._done( ws.env, ws.cn, true ) )
        this.waiting_cns.length = 0;
    }

    clean( cb: ( err: Error ) => void ): void {
        this.db.clean( () => {
            rimraf( this.build_dir, err => {
                if ( err ) return cb( err );
                mkdir_rec_sync( this.build_dir );
                this.db.init();
                cb( null );
            } );
        } );
    }

    _done( env: CompilationEnvironment, cn: CompilationNode, err = false ): void {
        // stuff to be made, error ot not
        function merge_ch_info( ch: CompilationNode ) {
            cn.pure_function = cn.pure_function && ch.pure_function;
            cn.file_dependencies.merge( ch.file_dependencies );
        }
        cn.children           .forEach( merge_ch_info );
        cn.additional_children.forEach( merge_ch_info );

        // if error => cleansing
        if ( err ) {
            return async.forEach( cn.generated, rimraf, rimraf_err => {
                this._exec_done_cb( env.com, cn, err );
            } );
        }

        // timing
        if ( env.verbose >= 2 && cn.type != "Id" ) {
            let t = process.hrtime( cn.start );
            env.com.note( cn, `Execution of ${ cn.pretty }: ${ t[ 0 ] + t[ 1 ] / 1e9 }` );
        }

        // outputs mtimes
        async.forEachOf( cn.outputs, ( output: string, num_output: number, callback ) => {
            fs.stat( output, ( err, stat ) => {
                if ( err ) {
                    env.com.error( cn, `Output ${ output } does not exist (after execution of ${ cn.pretty }).` );
                    return callback( true );
                }
                cn.output_mtimes[ num_output ] = stat.mtime.getTime();
                callback();
            } );
        }, ( err ) => {
            if ( err )
                return this._done( env, cn, true );

            // save in db (we don't have wait for a complete save)
            if ( cn.pure_function ) {
                this.db.put( cn.signature, JSON.stringify( {
                    outputs               : cn.outputs,
                    output_mtimes         : cn.output_mtimes,
                    exe_data              : cn.exe_data,
                    generated             : cn.generated,
                    failed                : [ ...cn.file_dependencies.failed ],
                    found                 : [ ...cn.file_dependencies.found.keys() ].map( name => [ name, cn.file_dependencies.found.get( name ) ] ),
                } as DataInDb ), err => {
                     console.assert( ! err, "TODO: db put error" );
                } );
            }

            // we're not going to write more stuff about this node
            this._exec_done_cb( env.com, cn, false );
        });
    }

    /** each nodes are visited once for each `make`, either they are already done or not */
    _visit( env: CompilationEnvironment, cn: CompilationNode, err: boolean ): void {
        // if we had an error, nothing to launch or save
        if ( err )
            return this._exec_done_cb( env.com, cn, err );

        // if has to be re-executed each time, we do not have to make tests
        if ( ! cn.pure_function )
            return this._launch( env, cn );

        // launched at least once ?
        if ( cn.num_build_exec )
            return this._done_for_this_build( env, cn );

        // else, we try to download data from db
        this.db.get( cn.signature, ( err, value: string ) => {
            // was not in db ?
            if ( err ) {
                if ( ! err.notFound )
                    env.com.error( cn, `Error while trying to get key ${ cn.signature } in db: ${ err }` );
                return this._launch( env, cn );
            }
            // else, look if dated or not
            try {
                this._done_in_db( env, cn, JSON.parse( value ) as DataInDb );
            } catch ( e ) {
                this._launch( env, cn );
            }
        } );
    }

    _done_for_this_build( env: CompilationEnvironment, cn: CompilationNode ): void {
        let _ko = ( msg: string ) => {
            if ( env.verbose )
                env.com.note( cn, `  Update of ${ cn.pretty }: reason = ${ msg }` );
            this._launch( env, cn );
        };

        // test for_found.failed
        async.forEach( [ ...cn.file_dependencies.failed.keys() ], ( name: string, cb: ( err: string ) => void ) => {
            fs.exists( name, exists => cb( exists ? `now, file ${ name } exists (that was not the case before)` : '' ) );
        }, ( err ) => {
            if ( err )
                return _ko( err );

            // test for_found.found
            async.forEach( [ ...cn.file_dependencies.found.keys() ], ( name: string, cb: ( err: string ) => void ) => {
                fs.stat( name, ( err, stats ) => {
                    if ( err ) return cb( `file ${ name } does not exist anymore` );
                    cb( stats.mtime.getTime() != cn.file_dependencies.found.get( name ) ? `file ${ name } has changed` : '' );
                } );
            }, ( err ) => {
                if ( err )
                    return _ko( err );

                // test output mtime
                async.forEach( [ ...cn.output_mtimes.keys() ], ( num: number, cb: ( err: string ) => void ) => {
                    const name = cn.outputs[ num ];
                    fs.stat( name, ( err, stats ) => {
                        if ( err ) return cb( `output file ${ name } does not exist anymore` );
                        cb( stats.mtime.getTime() != cn.output_mtimes[ num ] ? `File ${ name } has been modified outside of nsmake. Nsmake will not take the initiative to change the content (you can delete it if you want nsmake to generate it again)` : '' );
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

    _done_in_db( env: CompilationEnvironment, cn: CompilationNode, json_data: DataInDb ): void {
        let _ko = ( msg: string ) => {
            if ( env.verbose )
                env.com.note( cn, `  Update of ${ cn.pretty }: reason = ${ msg }` );
            this._launch( env, cn );
        };

        // test for_found.failed
        async.forEach( json_data.failed, ( name: string, cb: ( err: string ) => void ) => {
            fs.exists( name, exists => cb( exists ? `now, file ${ name } exists (that was not the case before)` : '' ) );
        }, ( err ) => {
            if ( err )
                return _ko( err );

            // test for_found.found
            async.forEach( json_data.found, ( [ name, mtime ], cb: ( err: string ) => void ) => {
                // const [ name ]
                fs.stat( name, ( err, stats ) => {
                    if ( err ) return cb( `file ${ name } does not exist anymore` );
                    cb( stats.mtime.getTime() != mtime ? `file ${ name } has changed` : '' );
                } );
            }, ( err ) => {
                if ( err )
                    return _ko( err );

                // test output mtime
                async.forEach( [ ...json_data.output_mtimes.keys() ], ( num: number, cb: ( err: string ) => void ) => {
                    const name = json_data.outputs[ num ];
                    fs.stat( name, ( err, stats ) => {
                        if ( err ) return cb( `output file ${ name } does not exist anymore` );
                        cb( stats.mtime.getTime() != json_data.output_mtimes[ num ] ? `File ${ name } has been modified outside of nsmake. Nsmake will not take the initiative to change the content (you can delete it if you want nsmake to generate it again)` : '' );
                    } );
                }, ( err ) => {
                    if ( err )
                        return _ko( err );

                    // sounds_good. => store db data in CompilationNode cn
                    cn.outputs                  = json_data.outputs;
                    cn.output_mtimes            = json_data.output_mtimes;
                    cn.exe_data                 = json_data.exe_data;
                    cn.generated                = json_data.generated;
                    cn.file_dependencies.failed = new Set<string>( json_data.failed );
                    cn.file_dependencies.found  = new Map<string,number>( json_data.found );

                    // everything seems to be ok :)
                    this._exec_done_cb( env.com, cn, false );
                } );

            } );

        } );
    }

    _exec_done_cb( com: CommunicationEnvironment, cn: CompilationNode, err: boolean ) : void {
        cn.num_build_done = this.num_build;

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
                cn.outputs = [ cn.args.target ];
                this._done( env, cn, false );
            } );
        }
        
        //
        if ( env.verbose ) {
            function cut( line: string ): string {
                if ( line.length < env.com.nb_columns )
                    return line;
                let res = line.slice( 0, env.com.nb_columns ), rem = line.slice( env.com.nb_columns ), nc = env.com.nb_columns - 5;
                for( ; rem.length > nc; rem = rem.slice( nc ) ) res += "\n  ..." + rem.slice( 0, nc );
                return rem.length ? res + "\n  ..." + rem : res;
            } // cn.pretty.length > env.com.nb_columns - 10 ? cn.pretty.slice( 0, env.com.nb_columns - 13 ) + "..." : cn.pretty 
            env.com.announcement( cn, cut( `Launch of ${ cn.pretty }` ) );
        }

        // if too much active service, wait a bit
        if ( this.services.filter( s => s.status == "active" ).length >= this.jobs ) {
            this.waiting_cns.push( { env, cn } );
            return;
        }

        // clear stuff like for_found, additional_children, ...
        cn._init_for_build();

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
                action  : "task",
                type    : ind_at >= 0 ? cn.type.slice( 0, ind_at ) : cn.type,
                children: cn.children.map( ch => ( { signature: ch.signature, outputs: ch.outputs, exe_data: ch.exe_data } ) ),
                args    : cn.args
            } ) + `\n` );
        };

        const service = this.services.find( s => s.status == "idle" && ( ! category || category == s.category ) );
        if ( service )
            use_service( service );
        else
            this._make_new_service( this.services.length, use_service, category, env.com );
    }

    _launch_waiting_cn_if_possible() {
        if ( this.waiting_cns.length && this.services.filter( s => s.status == "active" ).length < this.jobs ) {
            let item = this.waiting_cns.shift();
            this._launch( item.env, item.cn );
        }
    }

    _make_new_service( pos = this.services.length, service_cb: ( service: Service ) => void, category = null as string, com = null as CommunicationEnvironment ): void {
        // what to do when we have the child process
        const init_cp = ( cp: child_process.ChildProcess, use_stdio: boolean ) => {
            if ( ! cp )
                return service_cb( null );

            let service = new Service;
            service.send = use_stdio ?
                ( ( data: string ) => { if ( service.cp ) service.cp.stdin.write( data ); } ) :
                ( ( data: string ) => { if ( service.cp ) service.cp.send( data ); } );
            service.category = category;
            service.cp = cp;

            this.services[ pos ] = service;

            // helpers
            const send         = ( args: any ) => service.send( JSON.stringify( args ) + "\n" );
            const send_error   = ( msg = "" ) => send( { action: 'error', msg } );
            const done = ( err: boolean ) => {
                if ( service.cn ) {
                    this._done( service.env, service.cn, err );
                    service.status = "idle";
                    service.env    = null;
                    service.cn     = null;
                    this._launch_waiting_cn_if_possible();
                }
            }

            let lines = "";
            const on_message = ( data: Buffer ) => {
                lines += data.toString();
                const index_lf = lines.lastIndexOf( "\n" );
                if ( index_lf >= 0 ) {
                    for( const line of lines.slice( 0, index_lf ).split( "\n" ) ) {
                        let args: any;
                        try {
                            args = JSON.parse( line );
                        } catch( e ) {
                            if ( service.env && service.env.com.active )
                                service.env.com.error( service.cn, `Error: while parsing '${ line }' for '${ service.cn.pretty }': ${ e.toString() }` );
                            return done( true );
                        }
                        // console.log( 'From service', { cn: service.cn.pretty, args } );

                        switch ( args.action ) {
                            // display
                            case "announcement": if ( service.env ) service.env.com.announcement( service.cn, args.msg ); else console.log( args.msg ); break;
                            case "note"        : if ( service.env ) service.env.com.note        ( service.cn, args.msg ); else console.log( args.msg ); break;
                            case "info"        : if ( service.env ) service.env.com.info        ( service.cn, args.msg ); else console.log( args.msg ); break;
                            case "error"       : if ( service.env ) service.env.com.error       ( service.cn, args.msg ); else console.log( args.msg ); break;

                            // actions
                            case "done":
                                // save result in local memory
                                service.cn.outputs       = args.output_summary.outputs;
                                service.cn.generated     = args.output_summary.generated;
                                service.cn.exe_data      = args.output_summary.exe_data;
                                service.cn.pure_function = args.output_summary.pure_function;
                                // the service is now idle and not linked to a specific env or cn
                                done( args.err );
                                break;
                            case "get_filtered_target":
                                service.env.get_compilation_node( args.target, args.cwd, service.cn.file_dependencies, ncn => {
                                    if ( ncn ) {
                                        service.status = "waiting";
                                        this.make( service.env, ncn, err => {
                                            service.status = "active";
                                            if ( err ) return send_error();
                                            service.cn.additional_children.push( ncn );
                                            send( { action: 'get_filtered_target', name: ncn.outputs[ 0 ], signature: ncn.signature } );
                                        } );
                                    } else
                                        send( { action: 'get_filtered_target', name: '', signature: '' } );
                                } );
                                break;
                            case "get_filtered_target_signature":
                                service.env.get_compilation_node( args.target, args.cwd, service.cn.file_dependencies, ncn =>
                                    send( { action: 'get_filtered_target_signature', signature: ncn ? ncn.signature : '' } )
                                );
                                break;
                            case "get_filtered_target_signatures":
                                async.map( args.targets, ( target: string, cb ) => {
                                    service.env.get_compilation_node( target, args.cwd, service.cn.file_dependencies, ncn => {
                                        cb( null, ncn ? ncn.signature : '' );
                                    } );
                                }, ( err, signatures ) => {
                                    send( { action: 'get_filtered_target_signatures', signatures } );
                                } );
                                break;
                            case "get_first_filtered_target_signature": {
                                let num = -1;
                                async.forEachSeries( args.targets, ( target: string, cb: ( err: CompilationNode ) => void ) => {
                                    service.env.get_compilation_node( target, args.cwd, service.cn.file_dependencies, ncn => {
                                        ++num;
                                        cb( ncn );
                                    } );
                                }, ncn => {
                                    send( { action: 'get_first_filtered_target_signature', signature: ncn ? ncn.signature : '', num } );
                                } );
                                break;
                            }
                            case "get_cn_data":
                                if ( args.signature ) {
                                    let ncn = service.env.com.proc.pool.factory( args.signature );
                                    service.status = "waiting";
                                    this.make( service.env, ncn, err => {
                                        if ( service.cp ) {
                                            service.status = "active";
                                            if ( err ) return send_error();
                                            service.cn.additional_children.push( ncn );
                                            send( { action: 'get_cn_data', signature: ncn.signature, outputs: ncn.outputs, exe_data: ncn.exe_data } );
                                        }
                                    } );
                                } else
                                    send( { action: 'get_cn_data', signature: "", outputs: [], exe_data: {} } );
                                break;
                            case "get_cns_data":
                                service.status = "waiting";
                                async.map( args.lst, ( sgn: string, cb: ( err: boolean, cn: CompilationNode ) => void ) => {
                                    if ( service.cp ) {
                                        if ( sgn ) {
                                            const ncn = service.env.com.proc.pool.factory( sgn );
                                            this.make( service.env, ncn, err => {
                                                service.cn.additional_children.push( ncn );
                                                cb( err, ncn );
                                            } );
                                        } else
                                            cb( false, null );
                                    } else
                                        cb( true, null );
                                }, ( err, ncns ) => {
                                    if ( service.cp ) {
                                        service.status = "active";
                                        if ( err ) return send_error();
                                        send( { action: 'get_cns_data', lst: ncns.map( cn => { return {
                                            signature: cn ? cn.signature : "", outputs: cn ? cn.outputs : [], exe_data: cn ? cn.exe_data : {}
                                        }; } ) } );
                                    } 
                                } );
                                break;
                            case "get_requires":
                                async.map( args.lst as Array<{cwd:string,requires:Array<string>}>, ( item: {cwd:string,requires:Array<string>}, cb: ( err: boolean, signatures: Array<string> ) => void ) => {
                                    this._find_requires( service.env, service.cn, item.cwd, args.js_env, item.requires, args.typescript, cb );
                                }, ( err: boolean, lst: Array<Array<string>> ) => {
                                    send( { action: 'get_requires', err, lst } );
                                } );
                                break;
                            case "register_aliases":
                                service.env.register_aliases( service.cn, args.lst );
                                break;
                            case "run_mission_node":
                                service.status = "waiting";
                                async.map( args.signatures, ( signature: string, cb ) => {
                                    const ncn = this.pool.factory( signature ); 
                                    this.make( service.env, ncn, err => {
                                        service.cn.additional_children.push( ncn );
                                        cb( err, ncn );
                                    } );
                                }, ( err, inp_cns: Array<CompilationNode> ) => {
                                    if ( service.cp ) {
                                        service.status = "active";
                                        if ( err ) return send_error();
                                        let nce = service.env.make_child( args.args, inp_cns );
                                        nce.get_mission_node( service.cn.file_dependencies, ncn => {
                                            if ( ! ncn )
                                                return send( { action: 'run_mission_node', outputs: null } );
                                            service.status = "waiting";
                                            this.make( nce, ncn, err => {
                                                service.status = "active";
                                                if ( err ) return send_error(); 
                                                service.cn.additional_children.push( ncn );
                                                send( { action: 'run_mission_node', outputs: ncn.outputs, signature: ncn.signature, exe_data: ncn.exe_data } );
                                            } );
                                        } );
                                    }
                                } );
                                break;
                            case "new_build_file":
                                this.new_build_file( service.env.cwd, args.orig, args.ext, args.dist, ( err, name ) => {
                                    if ( err ) return send_error( err.toString() );
                                    send( { action: 'new_build_file', name } );
                                    service.cn.generated.push( name );
                                } );
                                break;
                            case "spawn_local": {
                                const id = this.waiting_spw.size.toString();
                                service.status = "waiting";
                                service.env.com.spawn_local( id, args );
                                this.waiting_spw.set( id, { env: service.env, cb: ( code: number ) => {
                                    this.waiting_spw.delete( id );
                                    service.status = "active";
                                    send( { action: 'spawn_local', code } );
                                } } );
                                break;
                            }
                            case "spawn":
                                // display
                                service.env.com.announcement( service.cn, [ args.cmd, ...args.args ].join( " " ) );

                                // execution, with basic redirection
                                const cp = child_process.spawn( args.cmd, args.args, { cwd: args.cwd } );
                                cp.stdout.on( "data", buffer => service.env.com.info ( service.cn, buffer.toString(), false ) );
                                cp.stderr.on( "data", buffer => service.env.com.error( service.cn, buffer.toString(), false ) );
                                cp.on( "error", err => { com.error( service.cn, err.toString() ); send( { action: 'spawn', code: -1 } ) } );
                                cp.on( "close", ( code, signal ) => { send( { action: 'spawn', code } ); } );
                                break;
                            case "run_install_cmd":
                                this._install_cmd( service.env.com, service.cn, args.category, args.cwd, args.cmd, err => {
                                    send( { action: 'run_install_cmd', err } );
                                } );
                                break;

                            // default
                            default:
                                service.env.com.error( service.cn, `Unknown service command '${ args.action }'` );
                                this._done( service.env, service.cn, true );
                        }
                    }
                    lines = lines.slice( index_lf + 1 );
                }
            };

            if ( use_stdio ) {
                service.cp.stdout.on( 'data', on_message );
                service.cp.stderr.on( 'data', data => { if ( service.env ) service.env.com.error( service.cn, data.toString(), false ); } );
            } else
                service.cp.on( 'message', on_message );

            service.cp.on( 'close', ( code: number, signal: string ) => {
                if ( signal )
                    service.env.com.error( service.cn, `Service ${ category } ended with signal ${ signal }` );
                done( true );
                // restart
                // if ( service.want_restart )
                //     this.services[ pos ] = this._make_new_service( pos );
            } );

            service.cp.on( 'error', err => {
                done( true );
            } );

            service_cb( service );
        };

        if ( category )
            this._make_cp_for_cat( category, com, init_cp );
        else
            init_cp( child_process.fork( `${ __dirname }/service.js` ), false );
    }

    /** make child process for a given "category" (which is actually the path of the service entry point) */
    _make_cp_for_cat( category: string, com: CommunicationEnvironment, init_cp: ( cp: child_process.ChildProcess, use_stdio: boolean ) => void ): void {
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
                    init_cp( child_process.spawn( ncn.outputs[ 0 ], [] ), true );
                    // init_cp( child_process.spawn( "valgrind", [ ncn.outputs[ 0 ] ] ), true );
                } );
            } );
        } );
    }

    _find_requires( env: CompilationEnvironment, cn: CompilationNode, cwd: string, js_env: string, requires: Array<string>, typescript: boolean, cb_find_require: ( err: boolean, signatures: Array<string> ) => void ) {
        const exts = typescript ? [ ".ts", ".tsx", ".d.ts" ] : [ ".js", ".jsx" ];

        // we have a list of list
        async.map( requires, ( str: string, require_cb: ( err: boolean, sgn: string ) => void ) => {
            if ( ! str )
                return require_cb( null, "" );

            // helper to test for a module (`str`) from a given directory (`dir`)
            const test_from = ( dir: string, install_allowed: boolean ) => {
                let trials = new Array< { name: string, type: number } >();

                if ( exts.indexOf( path.extname( str ).toLowerCase() ) >= 0 ) {
                    trials.push({ name: path.resolve( dir, str ), type: 0 }); // foo.js
                } else {
                    for( let ext_trial of exts )
                        trials.push({ name: path.resolve( dir, str + ext_trial ), type: 0 }); // foo.js, foo.jsx...
                    trials.push({ name: path.resolve( dir, str, "package.json" ), type: 1 }); // foo/package.json
                    for( let ext_trial of exts )
                        trials.push({ name: path.resolve( dir, str, "index" + ext_trial ), type: 0 }); // foo/index.js, foo/index.jsx...
                }
                // we want the signature of the first coming ncn 
                async.forEachSeries( trials, ( trial, cb_trial ) => {
                    env.get_compilation_node( trial.name, dir, cn.file_dependencies, ncn =>
                        cb_trial( ncn ? ( trial.type ? env.com.proc.pool.New( "MainJsFromPackageJson", [ ncn ], { js_env, typescript } ) : ncn ) : null )
                    );
                }, ( ncn: CompilationNode ) => {
                    ncn ? require_cb( null, ncn.signature ) : try_installation( install_allowed, dir );
                } )
            };
            const try_installation = ( install_allowed: boolean, node_modules_dir: string ) => {
                // currently we only install module without relative paths
                if ( ! install_allowed )
                    return require_cb( null, '' );
                //
                if ( ! node_modules_dir ) {
                    // if file is in the launch directory, we add a node_module here
                    if ( cwd.startsWith( env.cwd ) ) {
                        const new_node_modules_dir = path.resolve( env.cwd, "node_modules" );
                        return fs.mkdir( new_node_modules_dir, err => {
                            if ( err && err.code != 'EEXIST' ) {
                                env.com.error( cn, `Impossible to create directory ${ new_node_modules_dir }` );
                                return require_cb( null, '' );
                            }
                            try_installation( install_allowed, new_node_modules_dir );
                        } );
                    }
                    //
                    env.com.error( cn, `Error while trying to load module '${ str }': there's no 'node_modules' directory from '${ cwd }' and the later is not in the launch dir ('${ env.cwd }'). Nsmake is not willing to create a 'node_modules' by itself... Please add a new one in '${ cwd }' or in a parent dir if you want nsmake to install the module (or... directly install the module, it would be another good solution :) )` );
                    return require_cb( null, '' );
                }
                //
                this._install_cmd( env.com, cn, "npm", path.dirname( node_modules_dir ), [ "npm", 'install', typescript ? `@types/` + str : str ], err => err ? require_cb( null, '' ) : test_from( node_modules_dir, false ) );
            };

            // local, or look for a 'node_modules' directory, starting from cwd
            if ( ( str.length >= 2 && str.substr( 0, 2 ) == "./"  ) || ( str.length >= 3 && str.substr( 0, 3 ) == "../" ) || ( str.length >= 1 && str[ 0 ] == '/' ) )
                test_from( cwd, false );
            else
                Processor._find_node_modules_directory( cn, cwd, typescript, ( tn: string ) => tn ? test_from( tn, true ) : try_installation( true, "" ) );
        }, cb_find_require );
    }

    /** ex category: npm... */
    _install_cmd( com: CommunicationEnvironment, cn: CompilationNode, category: string, cwd: string, cmd: Array<string> | string, cb: ( err: boolean ) => void ) {
        const key = category + ":" + cwd;
        if ( this.current_install_cmds.has( key ) )
            return this.waiting_install_cmds.push( { com, cn, category, cwd, cmd, cb } );
        this.current_install_cmds.add( key );
            
        const cont = () => {
            this.current_install_cmds.delete( key );
            if ( this.waiting_install_cmds.length ) {
                const item = this.waiting_install_cmds.shift();
                this._install_cmd( item.com, item.cn, item.category, item.cwd, item.cmd, item.cb );
            }
        }

        com.announcement( cn, typeof cmd == "string" ? cmd : cmd.join( " " ) );
        const cp = typeof cmd == "string" ?
            child_process.exec( cmd, { cwd } ) : 
            child_process.spawn( cmd[ 0 ], cmd.slice( 1 ), { cwd } );
        cp.stdout.on( "data", buffer => com.info ( cn, buffer.toString(), false ) );
        cp.stderr.on( "data", buffer => com.error( cn, buffer.toString(), false ) );
        cp.on( "error", err => { com.error( cn, err.toString() ); cont(); cb( true ); } );
        cp.on( "close", ( code, signal ) => { cont(); cb( Boolean( code || signal ) ); } );
    }

    static _find_node_modules_directory( cn: CompilationNode, cwd: string, typescript: boolean, cb: ( tn: string ) => void ) {
        let tn = path.resolve( cwd, "node_modules" );
        fs.stat( tn, ( err, stats ) => {
            if ( ! err && stats.isDirectory )
                return cb( typescript ? path.resolve( tn, "@types" ) : tn );
            const ncwd = path.dirname( cwd );
            cn.file_dependencies.failed.add( cwd );
            ncwd != cwd ? Processor._find_node_modules_directory( cn, ncwd, typescript, cb ) : cb( "" ); 
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

        let mp = new Mp;
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

    nsmake_dir           : string;
    build_dir            : string;
    jobs                 = os.cpus().length;
    pool                 = new Pool();
    num_build            = 0;                    /** incremented each time we launch a new build. We assume that files are not changed during the process */
    db                   : Db;
    services             = new Array<Service>();
    building             = false;
    waiting_cns          = new Array<{ env: CompilationEnvironment, cn: CompilationNode }>();
    waiting_spw          = new Map<string,{ env: CompilationEnvironment, cb: ( code: number ) => void }>();
    waiting_build_seqs   = new Array<{ at_launch_cb: () => void, cb: ( done_cb: () => void ) => void }>(); 
    current_install_cmds = new Set<string>();
    waiting_install_cmds = new Array< { com: CommunicationEnvironment, cn: CompilationNode, category: string, cwd: string, cmd: Array<string> | string, cb: ( err: boolean ) => void } >();
}

/** random part for tmp filenames */
class Mp {
    val(): string {
        switch ( this.phase ) {
            case 0: return "";
            case 1: return "-" + this.cpt.toString();
            case 2: return "-" + Mp.rand( 3 );
            case 3: return "-" + Mp.rand( 10 );
        }
    }

    next(): void {
        switch ( this.phase ) {
            case 0: this.phase = 1; break;
            case 1: if ( ++this.cpt >= 10 ) { this.phase = 2; this.cpt = 0; } break;
            case 2: if ( ++this.cpt >= 100 ) { this.phase = 3; this.cpt = 0; } break;
            case 3: break;
        }
    }

    /** random string of length l
     * adapted from http://blog.tompawlak.org/how-to-generate-random-values-nodejs-javascript
     */
    static rand( l: number ): string {
        const url_comp_chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        let buff = null as Buffer;
        try {
            buff = crypto.randomBytes( l );
        } catch ( e ) {
            buff = crypto.pseudoRandomBytes( l );
        }

        let res = "";
        buff.forEach( i => res += url_comp_chars[ i % url_comp_chars.length ] );
        return res;
    }

    phase = 0;
    cpt   = 0;
}

