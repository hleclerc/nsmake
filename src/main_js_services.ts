require('source-map-support').install();
import Task    from "./Task"
import * as fs from "fs"

// register task names
function adt( name: string ) { task_types.set( name, require( "./" + name ).default ); }
let task_types = new Map<string,typeof Task>();
adt( "MainJsFromPackageJson" );
adt( "CoffeescriptCompiler"  );
adt( "TypescriptCompiler"    );
adt( "ConcatYamlToJson"      );
adt( "BaseCompilerInfo"      );
adt( "SassCompiler"          );
adt( "MissionMaker"          );
adt( "JsDepFactory"          );
adt( "CheckPrerequ"          );
adt( "CppCompiler"           );
adt( "MakeFile"              );
adt( "CssParser"             );
adt( "JsParser"              );
adt( "Executor"              );
adt( "Codegen"               );
adt( "Linker"                );
adt( "Mocha"                 );
adt( "Gtest"                 );
adt( "Sleep"                 );

// helpers for communication
function send_err( msg: string ) {
    process.send( JSON.stringify( { action: "error", args: { msg } } ) + "\n" );
}

function send_end( err: string | boolean, output_summary = {} ) {
    if ( typeof err == "string" ) {
        if ( err )
            send_err( err );
        send_end( true, output_summary );
    } else
        process.send( JSON.stringify( { action: "done", args: { err, output_summary } } ) + "\n" );
}

// we need stdin for synchronous communication (may be not necessary in a lot of cases, but necessary for instance for the typescript compiler, ...)
// this code is stolen from https://gist.github.com/espadrine/172658142820a356e1e0
let stdin_fd = ( process.stdin as any ).fd;
if ( typeof stdin_fd != "number" )
    stdin_fd = fs.openSync( '/dev/stdin', 'rs' );

// read data
let lines = "", active_task = null as Task;
process.on( 'message', ( data: Buffer ) => {
    lines += data.toString();
    const index_lf = lines.lastIndexOf( "\n" );
    if ( index_lf >= 0 ) {
        const part = lines.slice( 0, index_lf );
        lines = lines.slice( index_lf + 1 );
        for( const line of part.split( "\n" ) ) {
            try {
                const args = JSON.parse( line );
                switch ( args.action ) {
                    case "task":
                        if ( active_task )
                            throw "Internal error: there's already an active task in this slot...";
                        const task_type = task_types.get( args.type ) as any;
                        if ( ! task_type )
                            return send_end( `Error: ${ args.type } is not a registered task type.` );
                        // execution
                        active_task            = new task_type;
                        active_task.stdin_fd   = stdin_fd;
                        active_task.nb_columns = args.nb_columns;
                        active_task.children   = args.children;
                        active_task.signature  = args.signature;

                        active_task._exec( args.args, err => {
                            send_end( err || false, active_task ? active_task._output_summary() : {} );
                            active_task = null;
                        } );
                        break;
                    case "error":
                        throw args.msg;
                    default:
                        if ( active_task )
                            active_task._msg( args );
                }
            } catch ( e ) {
                send_end( typeof e == 'string' ? e : `Error: ${ e.stack }`, active_task ? active_task._output_summary() : {} );
                active_task = null;
            }
        }
    }
} );

process.once( 'SIGTERM', () => {
    if ( active_task ) {
        for( const cp of active_task._active_spawns ) {
            send_err( `Yup ${ active_task.signature }` );
            try { ( cp.stdin as any ).pause(); } catch ( e ) {}
            cp.kill();
        }
        active_task._killed = true;
    }
    process.exit( 1 );
} );
