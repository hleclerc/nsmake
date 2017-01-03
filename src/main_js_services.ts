require('source-map-support').install();
import Task from "./Task"

//
function adt( name: string ) { tasks.set( name, require( "./" + name ).default ); }
let tasks = new Map<string,typeof Task>();
adt( "MainJsFromPackageJson" );
adt( "CoffeescriptCompiler"  );
adt( "TypescriptCompiler"    );
adt( "ConcatYamlToJson"      );
adt( "BaseCompilerInfo"      );
adt( "MissionMaker"          );
adt( "JsDepFactory"          );
adt( "CppCompiler"           );
adt( "MakeFile"              );
adt( "JsParser"              );
adt( "Executor"              );
adt( "Codegen"               );
adt( "Linker"                );
adt( "Mocha"                 );
adt( "Gtest"                 );
adt( "Sleep"                 );

// helpers for communication
function send_err( msg: string ) {
    process.send( JSON.stringify( { action: "error", args:{ msg } } ) + "\n" );
}

function send_end( err: string | boolean, output_summary = {} ) {
    if ( typeof err == "string" ) {
        if ( err )
            send_err( err );
        send_end( true, output_summary );
    } else
        process.send( JSON.stringify( { action: "done", args: { err, output_summary } } ) + "\n" );
}

// read data
let lines = "", active_service = null as Task;
process.on( 'message', ( data: Buffer ) => {
    lines += data.toString();
    console.log( "receiving", lines );
            
    const index_lf = lines.lastIndexOf( "\n" );
    if ( index_lf >= 0 ) {
        const part = lines.slice( 0, index_lf );
        lines = lines.slice( index_lf + 1 );
        console.log( "remaining:", JSON.stringify( lines ) );
        
        for( const line of part.split( "\n" ) ) {
            try {
                const args = JSON.parse( line );
                switch ( args.action ) {
                    case "task":
                        if ( active_service )
                            throw "Internal error: there's already an active task in this slot...";
                        const task = tasks.get( args.type ) as any;
                        if ( ! task )
                            return send_end( `Error: ${ args.type } is not a registered task type.` );
                        // execution
                        // console.log( "starting:", args.type, JSON.stringify( args.args ) );
                        active_service = new task;
                        active_service.children  = args.children;
                        active_service.signature = args.signature;
                        if ( active_service.exec.length == 1 ) {
                            // sequential version
                            active_service.exec( args.args );
                            send_end( false, active_service._output_summary() );
                            active_service = null;
                        } else {
                            // callback version
                            active_service.exec( args.args, err => {
                                send_end( err || false, active_service._output_summary() );
                                active_service = null;
                            } );

                        } 
                        break;
                    case "error":
                        throw args.msg;
                    default:
                        if ( active_service )
                            active_service._msg( args );
                }
            } catch ( e ) {
                send_end( typeof e == 'string' ? e : `Error: ${ e.stack }`, active_service ? active_service._output_summary() : {} );
                active_service = null;
            }
        }
    }
} );
