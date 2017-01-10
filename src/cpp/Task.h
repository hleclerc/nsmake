#pragma once

#include "System/Json.h"
#include <fstream>

/**
 */
class Task {
public:
    struct CnData {
        void write_to_stream( std::ostream &os ) const { PO( os, signature, outputs, exe_data ); }

        std::string              signature;
        std::vector<std::string> outputs;
        Json::Value              exe_data;
    };
    struct NumAndSignature {
        operator bool() const { return ! signature.empty(); }

        unsigned    num;
        std::string signature;
    };
    using Pbs = std::pair<bool,std::string>;

    Task( const Json::Value &root );

    void               error                              ( std::string msg ); ///< send an error message
    void               note                               ( std::string msg ); ///< send an note message
    void               info                               ( std::string msg ); ///< send an info message
    void               announcement                       ( std::string msg ); ///< send an annoucement

    std::string        read_file_sync                     ( std::string name );                                                        ///< read all the content of file `name`
    void               write_file_sync                    ( std::string name, const std::string &content );                            ///< read all the content of file `name`

    std::string        get_filtered_target_signature      ( std::string target, std::string cwd );                                     ///< get signature for generator of `target`. This version does not launch execution
    NumAndSignature    get_first_filtered_target_signature( std::vector<std::string> targets, std::string cwd );                       ///< get signature for generator of first possible `target`
    CnData             get_cn_data                        ( std::string signature );                                                   ///< get outputs/exe_data of a Compilation Node. children = array of signatures
    std::string        new_build_file                     ( std::string orig_name, std::string ext = "", std::string dist = "" );      ///<
    int                spawn_sync                         ( std::string cwd, std::string cmd, std::vector<std::string> args );         ///<
    bool               run_install_cmd                    ( std::string cwd, std::string cmd, std::vector<std::string> prerequ = {} ); ///< return true if error
    Pbs                run_yaml_install_cmd               ( std::string cwd, Json::Value cmd, Json::Value system_info );               ///< return true if error
    void               register_aliases                   ( const std::vector<std::pair<std::string,std::string>> &aliases, std::string cur_dir ); ///<
    std::string        nsmake_cmd                         ( const std::vector<std::string> &args, const std::string &cwd );            ///<
    std::string        nsmake_run                         ( const std::vector<std::string> &args, const std::string &cwd );            ///<
    CnData             run_mission_node                   ( const Json::Value &args, const std::vector<std::string> &signatures );     ///< in args, stuff which is described as a number whereas a string would be expected means that the string is the output of signature[ the number ]
    void               append_to_env_var                  ( std::string env_var, std::string value );

    std::string        make_signature                     ( std::string type, std::vector<std::string> children_signatures, Json::Value args );
    static bool        system_is_in                       ( const std::vector<std::string> &systems, const Json::Value &sys );

    static void        send_done                          ( Task *task = 0 );                                                       ///< null task => error
    static void        _send                              ( const std::string &action, const Json::Value &args );
    static Json::Value _send_and_wait                     ( const std::string &action, const Json::Value &args );
    static Json::Value wait_for_line                      ();


    // /// send an announcement */
    // announcement( msg: string ): void {
    //     process.send( JSON.stringify( { action: "announcement", msg } ) + "\n" );
    // }
    //
    // /// send a note */
    // note( msg: string ): void {
    //     process.send( JSON.stringify( { action: "note", msg } ) + "\n" );
    // }
    //
    // /// send an informational message */
    // info( msg: string ): void {
    //     process.send( JSON.stringify( { action: "info", msg } ) + "\n" );
    // }
    //

    //
    // /// get signature + result (output filename) of generator for `target` */
    // get_filtered_target( target: string, cwd: string, mandatory = true ): { name: string, signature: string } {
    //     const res = this._send_and_wait( { action: "get_filtered_target", target, cwd } );
    //     if ( mandatory && ! res.name )
    //         throw `Don't known how to read or build '${ target }'`;
    //     return { name: res.name, signature: res.signature };
    // }
    //
    // /// get signature for generator of `target`. This version does not launch execution  */
    // get_filtered_target_signature( target: string, cwd: string, mandatory = true ): string {
    //     const res = this._send_and_wait( { action: "get_filtered_target_signature", target, cwd } ).signature;
    //     if ( mandatory && ! res )
    //         throw `Don't known how to read or build '${ target }'`;
    //     return res;
    // }
    //
    // /// get signature for generator of `target`. This version does not launch execution  */
    // get_filtered_target_signatures( targets: Array<string>, cwd: string, mandatory = true ): Array<string> {
    //     const res = this._send_and_wait( { action: "get_filtered_target_signatures", targets, cwd } ).signatures;
    //     if ( res.some( x => ! x ) ) {
    //         for( let num = 0; num < targets.length; ++num )
    //             if ( ! res[ num ] )
    //                 this.error( `Don't known how to read or build '${ targets[ num ] }'` );
    //         throw '';
    //     }
    //     return res;
    // }
    //

    //
    // /// get outputs/exe_data parallely for a set of Compilation Nodes. lst = array of signatures */
    // get_cns_data( lst: Array<string> ): Array<ChildData> {
    //     const res = this._send_and_wait( { action: "get_cns_data", lst } ).lst;
    //     return res.map( cnd => ( { signature: cnd.signature, outputs: cnd.outputs, exe_data: cnd.exe_data } ) );
    // }
    //
    // /// result = array of signatures */
    // get_requires( lst: Array<{cwd:string,requires:Array<string>}>, typescript = false ): Array<Array<string>> {
    //     return this._send_and_wait( { action: "get_requires", lst, typescript } ).lst;
    // }
    //
    // /// in args, stuff which is described as a number whereas a string would be expected means that the string is the output of signature[ the number ] */
    // run_mission_node( args, signatures: Array<string>, mandatory = true ): Array<string> {
    //     const res = this._send_and_wait( { action: "run_mission_node", args, signatures } );
    //     if ( ! res.outputs && mandatory )
    //         throw `Did not find what to do (what mission) for ${ JSON.stringify( args, ( key, val ) => key.startsWith( "_" ) ? undefined : val ) }, signatures = ${ signatures }`;
    //     return res.outputs;
    // }
    //
    // /// children = array of signatures */
    // make_signature( type: string, children: Array<string>, args: any ): string {
    //     return JSON.stringify( [ type, children.map( sgn => JSON.parse( sgn ) ), args ] );
    // }
    //
    // /// */
    // new_build_file( orig = "", ext = "", dist = "" ): string {
    //     return this._send_and_wait( { action: "new_build_file", orig, ext, dist } ).name;
    // }
    //
    // /// */
    // register_aliases( lst: Array< { key: string, val: string} > ): void  {
    //     process.send( JSON.stringify( { action: "register_aliases", lst } ) + "\n" );
    // }
    //
    // /// */
    // spawn( executable: string, args: Array<string>, local_execution = false, redirect = '' ): number {
    //     // display
    //     this.announcement( `${ [ executable, ...args ].join( " " ) }${ redirect ? " > " + redirect : "" }` );
    //
    //     // to be launched by the client ?
    //     if ( local_execution ) {
    //         const res = this._send_and_wait( { action: "spawn_local", executable, args, redirect } );
    //         return res.code;
    //     }
    //
    //     // execution inside the service
    //     const cp = child_process.spawnSync( executable, args );
    //     if ( cp.error )
    //         throw cp.error;
    //     if ( cp.stderr.length )
    //         this.error( cp.stderr.toString() );
    //     if ( cp.status )
    //         throw '';
    //
    //     // outputs
    //     if ( redirect ) {
    //         this.write_file_sync( redirect, cp.stdout );
    //         this.generated.push( redirect );
    //     } else if ( cp.stdout.length )
    //         this.info( cp.stdout.toString() );
    // }
    //
    // /// */
    // write_file_sync( filename: string, content: string ): void {
    //     fs.writeFileSync( filename, content );
    // }
    //
    // /// */
    // read_file_sync( filename: string ): Buffer {
    //     return fs.readFileSync( filename );
    // }
    //
    // /// */
    // read_dir_sync( directory: string ): Array<string> {
    //     return fs.readdirSync( directory );
    // }
    //
    // /// */
    // read_file( filename: string, cb: ( err: Error, content: Buffer ) => void ): void {
    //     fs.readFile( filename, cb );
    // }
    //
    // /// */
    // stat_sync( filename: string ): fs.Stats {
    //     return fs.statSync( filename );
    // }
    //
    // /// */
    // is_directory( dir: string ): boolean {
    //     try { return fs.statSync( dir ).isDirectory(); } catch ( error ) { return false; }
    // };
    //
    // /// like path.relative, with at least one dot at the beginning of the result */
    // rel_with_dot( from: string, to: string ) : string {
    //      let res = path.relative( from, to );
    //      return res.startsWith( '.' + path.sep ) || res.startsWith( '..' + path.sep ) ? res : './' + res;
    // }
    //
    // /// */
    // _send_and_wait( cmd: { action: string, [ key: string ]: any } ): any {
    //     process.send( JSON.stringify( cmd ) + "\n" );
    //     deasync.loopWhile( () => this._messages.every( msg => msg.action != cmd.action ) );
    //     const index = this._messages.findIndex( msg => msg.action == cmd.action );
    //     const res = this._messages[ index ];
    //     this._messages.splice( index, 1 );
    //     return res;
    // }
    //
    // /// */
    // _msg( args ) {
    //     this._messages.push( args );
    // }
    //
    // /// */
    // _output_summary() {
    //     return {
    //         outputs            : this.outputs,
    //         generated          : this.generated,
    //         exe_data           : this.exe_data,
    //         pure_function      : this.pure_function,
    //     };
    // }
    //

    // input
    std::string              signature;
    std::vector<CnData>      children;
    Json::Value              args;


    // output
    bool                     err;
    std::vector<std::string> outputs;
    std::vector<std::string> generated;
    bool                     pure_function;
    Json::Value              exe_data;
};
