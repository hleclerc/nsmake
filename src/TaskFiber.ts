import { SystemInfo }   from './SystemInfo';
import Task, { CnData } from "./Task"
import * as fibers      from "fibers"
import * as fs          from 'fs';


/** A variant of Task where exec is run within a Fiber. Allows synchronous version of helpers */
abstract class TaskFiber extends Task {
    /** */
    abstract exec( args, done: ( err: boolean ) => void );

    /** get null or signature + result (output filename) of generator for `target` */
    get_filtered_target_sync( target: string, cwd: string ): { name: string, signature: string } {
        return this._call( this.get_filtered_target, [], target, cwd );
    }

    /** get signature for generator of `target`. This version does not launch execution  */
    get_filtered_target_signature_sync( target: string, cwd: string ): string {
        return this._call( this.get_filtered_target_signature, [], target, cwd );
    }

    /** get signature for generator of `target`. This version does not launch execution  */
    get_filtered_target_signatures_sync( targets: Array<string>, cwd: string, care_about_target = false ): Array<string> {
        return this._call( this.get_filtered_target_signatures, [ care_about_target ], targets, cwd );
    }

    /** get signature for generator of first possible `target`. num is the number in the list */
    get_first_filtered_target_signature_sync( targets: Array<string>, cwd: string, allow_generation = true ): { signature: string, num: number } {
        return this._call( this.get_first_filtered_target_signature, [ allow_generation ], targets, cwd );
    }

    /** get outputs/exe_data of a Compilation Node. children = array of signatures */
    get_cn_data_sync( signature: string ): CnData {
        return this._call( this.get_cn_data, [], signature );
    }

    /** get outputs/exe_data parallely for a set of Compilation Nodes. lst = array of signatures */
    get_cns_data_sync( lst: Array<string> ): Array<CnData> {
        return this._call( this.get_cns_data, [], lst );
    }

    /** result = array of signatures */
    get_requires_sync( lst: Array<{cwd:string,requires:Array<string>}>, js_env: string, typescript = false ): Array<Array<string>> {
        return this._call( this.get_requires, [ typescript ], lst, js_env );
    }

    /** in args, stuff which is described as a number whereas a string would be expected means that the string is the output of signature[ the number ] */
    run_mission_node_sync( args: any, signatures: Array<string> ): CnData {
        return this._call( this.run_mission_node, [], args, signatures );
    }

    /** return true if error */
    run_install_cmd_sync( cwd: string, cmd: Array<string> | string, prerequ: Array<string> ): boolean {
        return this._call( this.run_install_cmd, [], cwd, cmd, prerequ );
    }

    /** return true if error. system is nullable */
    run_yaml_install_cmd_sync( cwd: string, rules: Array<any>, system_info: SystemInfo ): string {
        return this._call( this.run_yaml_install_cmd, [], cwd, rules, system_info );
    }

    /** return true if error */
    check_prerequ_sync( req: string ): boolean {
        return this._call( this.check_prerequ, [], req );
    }

    /** @param dist: optionnal root target directory (e.g. for public files) */
    new_build_file_sync( orig = "", ext = "", dist = "", value = null as string ): string {
        return this._call( this.new_build_file, [ value ], orig, ext, dist );
    }

    /** */
    nsmake_cmd_sync( args: Array<string>, cwd: string, ext: string, default_lang = ".js" ): string {
        return this._call( this.nsmake_cmd, [ default_lang ], args, cwd, ext );
    }

    /** */
    nsmake_run_sync( args: Array<string>, cwd: string, ext: string ): string {
        return this._call( this.nsmake_run, [], args, cwd, ext );
    }

    /** wrapper for a potential network abstraction */
    write_file_sync( filename: string, content: string | Buffer ): void {
        fs.writeFileSync( filename, content );
    }

    /** wrapper for a potential network abstraction */
    read_file_sync( filename: string ): Buffer {
        return fs.readFileSync( filename );
    }

    /** */
    stat_sync( filename: string ): fs.Stats {
        return fs.statSync( filename );
    }

    /** */
    is_directory_sync( dir: string ): boolean {
        try { return fs.statSync( dir ).isDirectory(); } catch ( e ) { return false; }
    };

    /** */
    _call( method, add_args, ...args ): any {
        let fiber = fibers.current, out = null;
        method.bind( this )( ...args, ( err, res ) => { if ( ! err ) out = res; fiber.run(); }, ...add_args );
        fibers.yield( null );
        return out;
    }

    /** */
    _exec( args, done: ( err: boolean ) => void ) {
        try {
            const fn = fibers( () => this.exec( args, done ) );
            fn.run();
        } catch ( err ) {
            if ( err )
                this.error( "Throwed error:" + err.toString() );
            done( true );
        }
    }
}
export default TaskFiber;
