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

/** */
abstract class Task {
    /** */
    abstract exec( args, done?: ( err: boolean ) => void );

    /** send an announcement */
    announcement( msg: string ): void {
        process.send( JSON.stringify( { action: "announcement", msg } ) + "\n" );
    }

    /** send a note */
    note( msg: string ): void {
        process.send( JSON.stringify( { action: "note", msg } ) + "\n" );
    }

    /** send an informational message */
    info( msg: string ): void {
        process.send( JSON.stringify( { action: "info", msg } ) + "\n" );
    }

    /** send an error message */
    error( msg: string ): void {
        process.send( JSON.stringify( { action: "error", msg } ) + "\n" );
    }

    /** get signature + result (output filename) of generator for `target` */
    get_filtered_target( target: string, cwd: string, mandatory = true ): { name: string, signature: string } {
        const res = this._send_and_wait( { action: "get_filtered_target", target, cwd } );
        if ( mandatory && ! res.name )
            throw `Don't known how to read or build '${ target }'`;
        return { name: res.name, signature: res.signature };
    }

    /** get signature for generator of `target`. This version does not launch execution  */
    get_filtered_target_signature( target: string, cwd: string, mandatory = true ): string {
        const res = this._send_and_wait( { action: "get_filtered_target_signature", target, cwd } ).signature;
        if ( mandatory && ! res )
            throw `Don't known how to read or build '${ target }'`;
        return res; 
    }

    /** get signature for generator of `target`. This version does not launch execution  */
    get_filtered_target_signatures( targets: Array<string>, cwd: string, mandatory = true ): Array<string> {
        const res = this._send_and_wait( { action: "get_filtered_target_signatures", targets, cwd } ).signatures;
        if ( res.some( x => ! x ) ) {
            for( let num = 0; num < targets.length; ++num )
                if ( ! res[ num ] )
                    this.error( `Don't known how to read or build '${ targets[ num ] }'` );
            throw '';
        }
        return res; 
    }

    /** get signature for generator of first possible `target`. num is the number in the list */
    get_first_filtered_target_signature( targets: Array<string>, cwd: string ): { signature: string, num: number } {
        const res = this._send_and_wait( { action: "get_first_filtered_target_signature", targets, cwd } );
        return res.signature ? { signature: res.signature, num: res.num } : null;
    }

    /** get outputs/exe_data of a Compilation Node. children = array of signatures */
    get_cn_data( signature: string ): CnData {
        const cnd = this._send_and_wait( { action: "get_cn_data", signature } );
        return { signature: cnd.signature, outputs: cnd.outputs, exe_data: cnd.exe_data };
    }

    /** get outputs/exe_data parallely for a set of Compilation Nodes. lst = array of signatures */
    get_cns_data( lst: Array<string> ): Array<CnData> {
        if ( lst.length == 0 ) return [];
        const res = this._send_and_wait( { action: "get_cns_data", lst } ).lst;
        return res.map( cnd => ( { signature: cnd.signature, outputs: cnd.outputs, exe_data: cnd.exe_data } ) );
    }

    /** result = array of signatures */
    get_requires( lst: Array<{cwd:string,requires:Array<string>}>, typescript = false ): Array<Array<string>> {
        return this._send_and_wait( { action: "get_requires", lst, typescript } ).lst;
    }

    /** in args, stuff which is described as a number whereas a string would be expected means that the string is the output of signature[ the number ] */
    run_mission_node( args, signatures: Array<string>, mandatory = true ): Array<string> {
        const res = this._send_and_wait( { action: "run_mission_node", args, signatures } );
        if ( ! res.outputs && mandatory )
            throw `Did not find what to do (what mission) for ${ JSON.stringify( args, ( key, val ) => key.startsWith( "_" ) ? undefined : val ) }, signatures = ${ signatures }`;
        return res.outputs;
    }

    /** return true if error */
    run_install_cmd( category: string, cwd: string, cmd: Array<string> | string ): boolean {
        return this._send_and_wait( { action: "run_install_cmd", category, cwd, cmd } ).err;
    }

    /** children = array of signatures */
    make_signature( type: string, children: Array<string>, args: any ): string {
        return JSON.stringify( [ type, children.map( sgn => JSON.parse( sgn ) ), args ] );
    }

    /** */
    new_build_file( orig = "", ext = "", dist = "" ): string {
        return this._send_and_wait( { action: "new_build_file", orig, ext, dist } ).name;
    }

    /** */
    register_aliases( lst: Array< { key: string, val: string} > ): void  {
        process.send( JSON.stringify( { action: "register_aliases", lst } ) + "\n" );
    }

    /** */
    spawn_sync( executable: string, args: Array<string>, local_execution = false, redirect = '' ): number {
        // display
        this.announcement( `${ [ executable, ...args ].join( " " ) }${ redirect ? " > " + redirect : "" }` );

        // to be launched by the client ?
        if ( local_execution ) {
            const res = this._send_and_wait( { action: "spawn_local", executable, args, redirect } );
            return res.code;
        } 

        // execution inside the service
        const cp = child_process.spawnSync( executable, args );
        if ( cp.error )
            throw cp.error;
        if ( cp.stderr.length )
            this.error( cp.stderr.toString() );
        if ( cp.status )
            throw '';

        // outputs        
        if ( redirect ) {
            this.write_file_sync( redirect, cp.stdout );
            this.generated.push( redirect );
        } else if ( cp.stdout.length )
            this.info( cp.stdout.toString() );
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
    stat_sync( filename: string ): fs.Stats {
        return fs.statSync( filename );
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

    /** */
    _send_and_wait( cmd: { action: string, [ key: string ]: any } ): any {
        process.send( JSON.stringify( cmd ) + "\n" );
        deasync.loopWhile( () => this._messages.every( msg => msg.action != cmd.action ) );
        const index = this._messages.findIndex( msg => msg.action == cmd.action );
        const res = this._messages[ index ];
        this._messages.splice( index, 1 );
        return res;
    }

    /** */
    _msg( args ) {
        this._messages.push( args );
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

    // output
    outputs             = new Array<string>();
    generated           = new Array<string>();
    pure_function       = true;                /** true is different execution with the same parameters yield the same results */
    exe_data            = {} as any;

    _messages           = new Array<any>();    /** messages from Processor */
}
export default Task;
