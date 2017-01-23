import { SystemInfo }     from './SystemInfo';
import * as stringify     from 'json-stable-stringify';
import * as child_process from 'child_process';
import * as path          from 'path';
import * as fs            from 'fs';

/** */
export 
interface CnData {
    signature: string;
    outputs  : Array<string>;
    exe_data : any;
}

/**
 * 
 */
abstract class Task {
    /** */
    abstract exec( args, done: ( err: boolean ) => void );

    /** send an announcement */
    announcement( msg: string ): void {
        process.send( JSON.stringify( { action: "announcement", args: { msg } } ) + "\n" );
    }

    /** send a note */
    note( msg: string ): void {
        process.send( JSON.stringify( { action: "note", args: { msg } } ) + "\n" );
    }

    /** send an informational message */
    info( msg: string ): void {
        process.send( JSON.stringify( { action: "info", args: { msg } } ) + "\n" );
    }

    /** send an error message */
    error( msg: string ): void {
        process.send( JSON.stringify( { action: "error", args: { msg } } ) + "\n" );
    }

    /** get null or signature + result (output filename) of generator for `target` */
    get_filtered_target( target: string, cwd: string, cb: ( err: boolean, res: { name: string, signature: string } ) => void ): void {
        this._send_and_wait( "get_filtered_target", { target, cwd }, cb );
    }

    /** get signature for generator of `target`. This version does not launch execution  */
    get_filtered_target_signature( target: string, cwd: string, cb: ( err: boolean, res: string ) => void ): void {
        this._send_and_wait( "get_filtered_target_signature", { target, cwd }, cb );
    }

    /** get signature for generator of `target`. This version does not launch execution  */
    get_filtered_target_signatures( targets: Array<string>, cwd: string, cb: ( err: boolean, res: Array<string> ) => void, care_about_target = false ): void {
        return targets.length ? this._send_and_wait( "get_filtered_target_signatures", { targets, cwd, care_about_target }, cb ) : cb( false, [] );
    }

    /** get signature for generator of first possible `target`. num is the number in the list */
    get_first_filtered_target_signature( targets: Array<string>, cwd: string, cb: ( err: boolean, res: { signature: string, num: number } ) => void, allow_generation = true ): void {
        return targets.length ? this._send_and_wait( "get_first_filtered_target_signature", { targets, cwd, allow_generation }, cb ) : cb( false, null );
    }

    /** get outputs/exe_data of a Compilation Node. children = array of signatures */
    get_cn_data( signature: string, cb: ( err: boolean, res: CnData ) => void ): void {
        return this._send_and_wait( "get_cn_data", { signature }, cb );
    }

    /** get outputs/exe_data parallely for a set of Compilation Nodes. lst = array of signatures */
    get_cns_data( lst: Array<string>, cb: ( err: boolean, res: Array<CnData> ) => void ): void {
        return lst.length ? this._send_and_wait( "get_cns_data", { lst }, cb ) : cb( false, [] );
    }

    /** result = array of signatures */
    get_requires( lst: Array<{cwd:string,requires:Array<string>}>, js_env: string, cb: ( err: boolean, res: Array<Array<string>> ) => void, typescript = false ): void {
        return lst.length ? this._send_and_wait( "GeneratorJs:get_requires", { lst, typescript, js_env }, cb ) : cb( false, [] );
    }

    /** in args, stuff which is described as a number whereas a string would be expected means that the string is the output of signature[ the number ] */
    run_mission_node( args: any, signatures: Array<string>, cb: ( err: boolean, res: CnData ) => void ): void {
        this._send_and_wait( "run_mission_node", { args, signatures }, cb );
    }

    /** return true if error */
    run_install_cmd( cwd: string, cmd: Array<string> | string, prerequ: Array<string>, cb: ( err: boolean, fail: boolean ) => void ): void {
        return this._send_and_wait( "run_install_cmd", { cwd, cmd, prerequ }, cb );
    }

    /** return true if error. system is nullable */
    run_yaml_install_cmd( cwd: string, rules: Array<any>, system_info: SystemInfo, cb: ( err: boolean, msg: string ) => void ): void {
        return this._send_and_wait( "run_yaml_install_cmd", { cwd, rules, system_info }, cb );
    }

    /** return true if error */
    check_prerequ( req: string, cb: ( err: boolean, fail: boolean ) => void ): void {
        return this._send_and_wait( "check_prerequ", { req }, cb );
    }

    /** @param dist: optionnal root target directory (e.g. for public files) */
    new_build_file( orig = "", ext = "", dist = "", cb: ( err: boolean, name: string ) => void, value?: string ): void {
        return value ? cb( null, value ) : this._send_and_wait( "new_build_file", { orig, ext, dist }, cb );
    }

    /** */
    nsmake_cmd( args: Array<string>, cwd: string, ext: string, cb: ( err: boolean, name: string ) => void, default_lang = ".js" ): void {
        this.run_mission_node( {
            entry_point    : 0,
            redirect       : -1,
            mission        : "run",
            cwd            : cwd,
            arguments      : args.slice( 2 ),
            idempotent     : true,
            local_execution: false,
            new_build_files: [ { orig: "NSMAKE_CMD_output", ext } ],
        }, [
            this.make_signature( "MakeFile", [], { content: args[ 0 ], orig: "", ext: args.length >= 2 ? args[ 1 ] : default_lang } )
        ], ( err, res: CnData ) => {
            if ( err )
                return cb( true, null );
            this.read_file( res.outputs[ 0 ], ( err, data ) => {
                if ( err ) {
                    this.error( err.toString() );
                    return cb( true, null );
                }
                cb( false, data.toString() );
            } );
        } );
    }

    nsmake_run( args: Array<string>, cwd: string, ext: string, cb: ( err: boolean, name: string ) => void ): void {
        this.get_filtered_target_signature( path.resolve( cwd, args[ 0 ] ), cwd, ( err, sgn ) => {
            if ( err)
                return cb( err, null );
            this.run_mission_node( {
                entry_point    : 0,
                redirect       : -1,
                mission        : "run",
                cwd            : cwd,
                arguments      : args.slice( 1 ),
                idempotent     : true,
                local_execution: false,
                new_build_files: [ { orig: "NSMAKE_RUN_output", ext } ],
            }, [ sgn ], ( err, res: CnData ) => {
                if ( err )
                    return cb( true, null );
                this.read_file( res.outputs[ 0 ], ( err, data ) => {
                    if ( err ) {
                        this.error( err.toString() );
                        return cb( true, null );
                    }
                    cb( false, data.toString() );
                } );
            } );
        } );
    }

    /** children = array of signatures */
    make_signature( type: string, children: Array<string>, args: any ): string {
        return stringify( [ type, children.map( sgn => JSON.parse( sgn ) ), args ] );
    }

    /** */
    _register_aliases( lst: Array< { key: string, val: string} > ): void  {
        process.send( JSON.stringify( { action: "register_aliases", args: { lst } } ) + "\n" );
    }

    /** */
    append_to_env_var( env_var: string, value: string ): void  {
        process.send( JSON.stringify( { action: "append_to_env_var", args: { env_var, value } } ) + "\n" );
    }

    /** */
    register_ext_lib( name: string, url: string, glob: string ): void  {
        process.send( JSON.stringify( { action: "GeneratorJs:register_ext_lib", args: { name, url, glob } } ) + "\n" );
    }

    /** */
    spawn( executable: string, args: Array<string>, cb: ( err: boolean, code: number ) => void, local_execution = false, redirect = '' ): void {
        // display
        this.announcement( `${ [ executable, ...args ].join( " " ) }${ redirect ? " > " + redirect : "" }` );

        // to be launched by the client ?
        if ( local_execution )
            return this._send_and_wait( "spawn_local", { executable, args, redirect }, cb );

        // launch locally
        const launch = ( fd: number ) => {
            const cp = child_process.spawn( executable, args );
            ( cp as any ).smurf = { executable, args };
            this._active_spawns.add( cp );

            cp.on( 'close', ( code, signal ) => { if ( fd >= 0 ) fs.closeSync( fd ); this._active_spawns.delete( cp ); cb( Boolean( signal ), signal ? -1 : code ); } );
            cp.on( 'error',       err        => { if ( fd >= 0 ) fs.closeSync( fd ); this._active_spawns.delete( cp ); cb( true, -1 ); } );

            cp.stdout.on( 'data', data => fd >= 0 ? fs.writeSync( fd, data ) : this.info( data.toString() ) );
            cp.stderr.on( 'data', data => this.error( data.toString() ) );
        }

        if ( redirect ) {
            fs.open( redirect, "w", ( err, fd ) => {
                if ( err ) {
                    this.error( err.toString() );
                    return cb( true, -1 );
                }
                launch( fd );
            } );
        } else
            launch( -1 );
    }

    /** for asynchronous versions */
    set_status( status: "active" | "waiting" ): void {
        process.send( JSON.stringify( { action: "set_status", args: { status } } ) + "\n" );
    }

    /** wrapper for a potential network abstraction */
    write_file( filename: string, content: string | Buffer, cb: ( err ) => void ): void {
        fs.writeFile( filename, content, cb );
    }

    /** wrapper for a potential network abstraction */
    read_file( filename: string, cb: ( err: Error, content: Buffer ) => void ): void {
        fs.readFile( filename, cb );
    }

    /** wrapper for a potential network abstraction */
    read_dir( directory: string, cb: ( err, content: Array<string> ) => void ): void {
        return fs.readdir( directory, cb );
    }

    /** */
    stat( filename: string, cb: ( err: NodeJS.ErrnoException, stat: fs.Stats ) => void ): void {
        fs.stat( filename, cb );
    }

    /** */
    mkdir( filename: string, cb: ( err: NodeJS.ErrnoException ) => void ): void {
        fs.mkdir( filename, cb );
    }

    /** */
    is_directory( dir: string, cb: ( ans: boolean ) => void ): void {
        fs.stat( dir, ( err, stats ) => cb( ! err && stats.isDirectory() ) );
    };

    /** like path.relative, with at least one dot at the beginning of the result */
    rel_with_dot( from: string, to: string ) : string {
         let res = path.relative( from, to );
         return res.startsWith( '.' + path.sep ) || res.startsWith( '..' + path.sep ) ? res : './' + res;
    }

    /** helper to get arg values when a string is expected but if it is a number, it refers to a child */
    av( n: string | number ): string {
        return typeof n == 'string' ? n : this.children[ n ].outputs[ 0 ];
    }

    /** diplay a (truncated if necessary) line with a ^ char behind a given column */
    src_err_msg( file: string, line: number, column: number ) {
        // we start with character at the center of the screen.
        let nc = this.nb_columns, dc = nc >> 1, extr = fs.readFileSync( file ).toString( "utf8" ).split( "\n" )[ line ];
        let b = column - dc, message = "";

        if ( b <= 0 ) {
            message += ( extr.length > nc ? extr.substr( 0, nc - 3 ) + "..." : extr ) + "\n";
            message += " ".repeat( column ) + "^\n";
        } else {
            message += "..." + ( extr.length - b > nc - 3 ? extr.substr( b, nc - 6 ) + "..." : extr.substr( b ) ) + "\n";
            message += " ".repeat( dc + 3 ) + "^\n";
        }
    }

    /** */
    find_directory_from( cwd: string, name: string, cb: ( err: boolean, tn: string ) => void, create_a_new_one = false, orig = cwd ) {
        let tn = path.resolve( cwd, name );
        this.stat( tn, ( err, stats ) => {
            // found ?
            if ( ! err && stats.isDirectory )
                return cb( null, tn );
            // look if there's a parent
            const ncwd = path.dirname( cwd );
            // no parent => create in orig
            if ( ncwd == cwd ) {
                if ( ! create_a_new_one ) {
                    this.error( `Unable to find a '${ name }' dir from ${ orig }` );
                    return cb( true, null );
                }
                const dir = path.resolve( orig, name );
                return this.mkdir( dir, err => {
                    if ( err ) return this.error( `Error: impossible to create directory '${ dir }'` ), cb( true, null );
                    cb( null, dir );
                } )
            }
            //
            this.find_directory_from( ncwd, name, cb, create_a_new_one, orig ); 
        } );
    }

    /** modify a global env argument */
    push_unique_in_global_arg( arg: string, val: any, cb: ( err: boolean ) => void ): void {
        this._send_and_wait( "push_unique_in_global_arg", { arg, val }, cb );
    }

    /** `if_wrong` is used only in sync mode */
    _send_and_wait( action, args: { [ key: string ]: any }, cb: ( err: boolean, res: any ) => void ): void {
        const msg_id = ++this._cur_id_waiting_cbs;
        process.send( JSON.stringify( { action, msg_id, args } ) + "\n" );
        this._waiting_cbs.set( msg_id, cb );
    }

    /** when a message is received from the server */
    _msg( args ) {
        const cb = this._waiting_cbs.get( args.msg_id );
        this._waiting_cbs.delete( args.msg_id );
        return cb( args.err, args.res );
    }

    /** called by main_js_services.js */
    _exec( args, done: ( err: boolean ) => void ) {
        this.exec( args, done );
    }

    /** */
    _output_summary() {
        return {
            outputs            : this.outputs,
            generated          : this.generated, 
            exe_data           : this.exe_data,
            idempotent         : this.idempotent   ,
        };
    }

    // input
    children            : Array<CnData>;
    signature           : string;
    stdin_fd            : number;
    nb_columns          : number;

    // output
    outputs             = new Array<string>();
    generated           = new Array<string>();
    idempotent          = true;                          /** true is different execution with the same parameters yield the same results */
    exe_data            = {} as any;

    _waiting_cbs        = new Map<number,( err: boolean, res: any )=>void>();
    _cur_id_waiting_cbs = 0;
    _active_spawns      = new Set<child_process.ChildProcess>();
    _killed             = false;
}
export default Task;
