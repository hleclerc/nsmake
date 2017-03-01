require('source-map-support').install();
import Task      from "./Task"
import * as path from "path"
import * as fs   from "fs"

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

export default
class GenericMicroService {
    add_module( name: string, val: typeof Task ) {
        this.task_types.set( name, val );
    }

    run() {
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
                                const task_type = this.task_types.get( args.type ) as any;
                                if ( ! task_type )
                                    return send_end( `Error: ${ args.type } is not a registered task type.` );
                                // execution
                                active_task            = new task_type;
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
    }

    task_types = new Map<string,typeof Task>();
}


