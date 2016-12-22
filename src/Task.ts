import * as stringify     from 'json-stable-stringify';
import * as child_process from 'child_process';
import * as path          from 'path';
import * as fs            from 'fs';
var deasync = require( 'deasync' );

/** */
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
    abstract exec( args, done?: ( err: boolean ) => void );

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

    /** get signature + result (output filename) of generator for `target` */
    get_filtered_target( target: string, cwd: string, cb = null as ( err: boolean, res: { name: string, signature: string } ) => void, throw_if_err = ! cb ): { name: string, signature: string } {
        const res = this._send_and_wait( "get_filtered_target", { target, cwd }, cb, throw_if_err );
        if ( throw_if_err && cb == null && res == null )
            throw `Don't know how to make or build target ${ target }`;
        return res;
    }

    /** get signature for generator of `target`. This version does not launch execution  */
    get_filtered_target_signature( target: string, cwd: string, cb = null as ( err: boolean, res: string ) => void, throw_if_err = ! cb ): string {
        const res = this._send_and_wait( "get_filtered_target_signature", { target, cwd }, cb, throw_if_err );
        if ( throw_if_err && cb == null && res == null )
            throw `Don't know how to make or build target ${ target }`;
        return res;
    }

    /** get signature for generator of `target`. This version does not launch execution  */
    get_filtered_target_signatures( targets: Array<string>, cwd: string, cb = null as ( err: boolean, res: Array<string> ) => void, care_about_target = false ): Array<string> {
        if ( targets.length == 0 ) return cb ? ( cb( false, [] ), null ) : [];
        return this._send_and_wait( "get_filtered_target_signatures", { targets, cwd, care_about_target }, cb );
    }

    /** get signature for generator of first possible `target`. num is the number in the list */
    get_first_filtered_target_signature( targets: Array<string>, cwd: string, cb = null as ( err: boolean, res: { signature: string, num: number } ) => void ): { signature: string, num: number } {
        if ( targets.length == 0 ) return cb ? ( cb( false, null ), null ) : null;
        return this._send_and_wait( "get_first_filtered_target_signature", { targets, cwd }, cb );
    }

    /** get outputs/exe_data of a Compilation Node. children = array of signatures */
    get_cn_data( signature: string, cb = null as ( err: boolean, res: CnData ) => void ): CnData {
        return this._send_and_wait( "get_cn_data", { signature }, cb );
    }

    /** get outputs/exe_data parallely for a set of Compilation Nodes. lst = array of signatures */
    get_cns_data( lst: Array<string>, cb = null as ( err: boolean, res: Array<CnData> ) => void ): Array<CnData> {
        if ( lst.length == 0 ) return cb ? ( cb( false, [] ), null ) : [];
        return this._send_and_wait( "get_cns_data", { lst }, cb );
    }

    /** result = array of signatures */
    get_requires( lst: Array<{cwd:string,requires:Array<string>}>, cb = null as ( err: boolean, res: Array<Array<string>> ) => void, typescript = false ): Array<Array<string>> {
        if ( lst.length == 0 ) return cb ? ( cb( false, [] ), null ) : [];
        return this._send_and_wait( "get_requires", { lst, typescript }, cb );
    }

    /** in args, stuff which is described as a number whereas a string would be expected means that the string is the output of signature[ the number ] */
    run_mission_node( args: any, signatures: Array<string>, cb = null as ( err: boolean, res: CnData ) => void, throw_if_err = ! cb ): CnData {
        const res = this._send_and_wait( "run_mission_node", { args, signatures }, cb, throw_if_err );
        if ( throw_if_err && cb == null && res == null )
            throw `Did not find what to do (what mission, ...) for ${ JSON.stringify( args, ( key, val ) => key.startsWith( "_" ) ? undefined : val ) }, signatures = ${ signatures }`;
        return res;
    }

    /** return true if error */
    run_install_cmd( category: string, cwd: string, cmd: Array<string> | string, prerequ: Array<string>, cb = null as ( err: boolean, fail: boolean ) => void ): boolean {
        return this._send_and_wait( "run_install_cmd", { category, cwd, cmd, prerequ }, cb );
    }

    /** @param dist: optionnal root target directory (e.g. for public files) */
    new_build_file( orig = "", ext = "", dist = "", cb = null as ( err: boolean, name: string ) => void ): string {
        return this._send_and_wait( "new_build_file", { orig, ext, dist }, cb );
    }

    /** children = array of signatures */
    make_signature( type: string, children: Array<string>, args: any ): string {
        return stringify( [ type, children.map( sgn => JSON.parse( sgn ) ), args ] );
    }

    /** */
    register_aliases( lst: Array< { key: string, val: string} > ): void  {
        process.send( JSON.stringify( { action: "register_aliases", lst } ) + "\n" );
    }

    /** */
    spawn( executable: string, args: Array<string>, cb = null as ( err: boolean, code: number ) => void, local_execution = false, redirect = '', throw_if_err = ! cb ): number {
        // display
        this.announcement( `${ [ executable, ...args ].join( " " ) }${ redirect ? " > " + redirect : "" }` );

        // to be launched by the client ?
        if ( local_execution )
            return this._send_and_wait( "spawn_local", { executable, args, redirect }, cb );

        // to be launched locally by asynchronously ?
        if ( cb ) {
            if ( redirect ) {
                this.error( 'TODO: redirect with async local microservice spawn' );
                cb( true, -1 );
                return null;
            }

            // execution inside the service, synchronously
            const cp = child_process.spawn( executable, args );
            cp.on( 'error', err => cb( true, -1 ) );
            cp.on( 'close', ( code, signal ) => cb( Boolean( signal ), signal ? -1 : code ) );

            // outputs        
            cp.stdout.on( 'data', data => this.info( data.toString() ) );
            cp.stderr.on( 'data', data => this.error( data.toString() ) );

            return null;
        }

        // execution inside the service, synchronously
        const cp = child_process.spawnSync( executable, args );
        if ( cp.error ) {
            if ( throw_if_err )
                throw cp.error;
            return -1;
        }
        if ( cp.stderr.length )
            this.error( cp.stderr.toString() );

        // outputs        
        if ( redirect ) {
            this.write_file_sync( redirect, cp.stdout );
            this.generated.push( redirect );
        } else if ( cp.stdout.length )
            this.info( cp.stdout.toString() );

        // status
        if ( throw_if_err && ( cp.status || cp.error || cp.signal ) )
            throw '';
        return cp.status;
    }

    /** for asynchronous versions */
    set_status( status: "active" | "waiting" ) {
        process.send( JSON.stringify( { action: "set_status", args: { status } } ) + "\n" );
    }

    /** */
    write_file_sync( filename: string, content: string ): void {
        fs.writeFileSync( filename, content );
    }

    /** */
    read_file_sync( filename: string ): Buffer {
        return fs.readFileSync( filename );
    }

    /** */
    read_dir_sync( directory: string ): Array<string> {
        return fs.readdirSync( directory );
    }

    /** */
    read_file( filename: string, cb: ( err: Error, content: Buffer ) => void ): void {
        fs.readFile( filename, cb );
    }

    /** */
    stat( filename: string, cb = null as ( err: NodeJS.ErrnoException, stat: fs.Stats ) => void ): fs.Stats {
        return cb ? ( fs.stat( filename, cb ), null ) : fs.statSync( filename );
    }

    /** */
    is_directory( dir: string ): boolean {
        try { return fs.statSync( dir ).isDirectory(); } catch ( error ) { return false; }
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

    /** `if_wrong` is used only in sync mode */
    _send_and_wait( action, args: { [ key: string ]: any }, cb: ( err: boolean, res: any ) => void, throw_if_error = false ): any {
        // send msg
        const msg_id = ++this._cur_id_waiting_cbs;
        process.send( JSON.stringify( { action, args, msg_id } ) + "\n" );

        // async version
        if ( cb ) {
            this._waiting_cbs.set( msg_id, cb );
            return null;
        }

        // sync version
        if ( ! cb ) {
            let result = null, done = false;
            this._waiting_cbs.set( msg_id, ( err: boolean, res: any ) => {
                if ( err && throw_if_error ) throw '';
                result = err ? null : res;
                done = true;
            } );
            deasync.loopWhile( () => done == false );
            return result;
        }
    }

    /** */
    _msg( args ) {
        const cb = this._waiting_cbs.get( args.msg_id );
        this._waiting_cbs.delete( args.msg_id );
        return cb( args.err, args.res );
    }

    /** */
    _output_summary() {
        return {
            outputs            : this.outputs,
            generated          : this.generated, 
            exe_data           : this.exe_data,
            pure_function      : this.pure_function,
        };
    }

    // input
    children            : Array<CnData>;
    signature           : string;

    // output
    outputs             = new Array<string>();
    generated           = new Array<string>();
    pure_function       = true;                          /** true is different execution with the same parameters yield the same results */
    exe_data            = {} as any;

    _waiting_cbs        = new Map<number,( err: boolean, res: any )=>void>();
    _cur_id_waiting_cbs = 0;
}
export default Task;
