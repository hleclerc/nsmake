import Task       from "./Task"
import * as async from "async" 
import * as path  from "path"  

interface Quoted     { type: "Quoted"    ; str : string;            }
interface OpeningPar { type: "OpeningPar"; beg : number;            }
interface ClosingPar { type: "ClosingPar"; end : number;            }
interface JsonData   { type: "JsonData"  ; end : number; data: any; }
interface SubExpr    { type: "SubExpr"   ; expr: string;            }
interface Target     { type: "Target"    ; name: string;            }

declare type Token = Quoted | OpeningPar | ClosingPar | JsonData | Target | SubExpr;

/**  
 */
export default
class Codegen extends Task {
    exec( args: { output: string, filename: string, cwd: string }, done: ( err: boolean ) => void ) {
        // parse filename (e.g. '(foo.js "arg"){define:["..."]}.js')
        const filename = decodeURIComponent( args.filename );
        const ind = Math.max( filename.lastIndexOf( ')' ), filename.lastIndexOf( '}' ) );
        const cmd = filename.slice( 1, ind + 1 ), ext = filename.slice( ind + 1 );
        const res = this._parse_filename( cmd );

        // preparation for async stuff
        let fts = new Array<string>();
        let nbd = new Array<string>();
        for( let tok of res.tokens ) {
            switch ( tok.type ) {
                case "Target":
                    fts.push( path.resolve( args.cwd, tok.name.startsWith( "#" ) ? path.resolve( __dirname, "..", "..", "rules", "gen", tok.name.slice( 1 ) ) : tok.name ) );
                    break;
                case "SubExpr":
                    nbd.push( "Codegen" );
                    break;
            }
        }

        async.map( fts, ( target, cb_fts ) => this.get_filtered_target_signature( target, args.cwd, cb_fts ), ( err: boolean, fts_sgns: Array<string> ) => {
            if ( err )
                return done( err );
            async.map( nbd, ( build_file, cb_nbd ) => this.new_build_file( null, null, null, cb_nbd ), ( err: boolean, nbd_names: Array<string> ) => {
                if ( err )
                    return done( err );
                //
                let inp_sgns = new Array<string>(), argv = new Array<string|number>();
                for( let tok of res.tokens ) {
                    switch ( tok.type ) {
                        case "Target":
                            argv.push( inp_sgns.length );
                            inp_sgns.push( fts_sgns.shift() );
                            break;
                        case "Quoted":
                            argv.push( tok.str );
                            break;
                        case "SubExpr":
                            argv.push( inp_sgns.length );
                            inp_sgns.push( this.make_signature( "Codegen", [], {
                                output  : nbd_names.shift(),
                                filename: tok.expr,
                                cwd     : args.cwd
                            } ) );
                            break;
                        default:
                            throw `While analyzing ${ cmd }: a token of type ${ tok.type } is not expected after the parsing stage`;
                    }
                }

                if ( res.tokens.length && res.tokens[ 0 ].type == "Quoted" ) {
                    if ( res.tokens.length < 2 || res.tokens[ 1 ].type != "Quoted" )
                        throw `If the first argument is quoted (script content), the second have also to be quoted (the extension of the script)`;
                    argv.splice( 0, 2, inp_sgns.push( this.make_signature( "MakeFile", [], { ext: argv[ 1 ], content: argv[ 0 ], } ) ) - 1 );
                }

                this.run_mission_node( Object.assign( {}, {
                    mission        : "run",
                    redirect       : args.output,
                    cwd            : args.cwd,
                    entry_point    : argv[ 0 ],
                    arguments      : argv.slice( 1 ),
                    local_execution: false,
                    idempotent     : true,
                    run_loc        : true, // for instance, if the entry_point is a js file, we want to ensure that we're not going to execute it on a browser
                }, res.json_data ), inp_sgns, ( err, res ) => {
                    this.outputs.push( args.output );
                    this.note( `done.err: ${ JSON.stringify( err ) }` );
                    done( err );
                } );
            } );
        } );
    }

    _parse_filename( d: string ): { tokens: Array<Token>, json_data: any } {
        // tokenize
        let tokens = new Array<Token>();
        for( let b = 0, e = d.length; b < e; ) {
            switch ( d[ b ] ) {
                case '"': {
                    const o = ++b;
                    for( ; b < e; ++b ) {
                        if ( d[ b ] == '\\' ) { if ( ++b >= e ) break; }
                        else if ( d[ b ] == '"' ) break;
                    }
                    if ( b < e ) {
                        tokens.push( { type: "Quoted", str: d.slice( o, b ) } );
                        ++b;
                    }
                    break;
                }
                case "'": {
                    const o = ++b;
                    for( ; b < e; ++b ) {
                        if ( d[ b ] == '\\' ) { if ( ++b >= e ) break; }
                        else if ( d[ b ] == "'" ) break;
                    }
                    if ( b < e ) {
                        tokens.push( { type: "Quoted", str: d.slice( o, b ) } );
                        ++b;
                    }
                    break;
                }
                case '{': {
                    const o = b;
                    b = this._parse_json( d, ++b, e );
                    try {
                        let data = '';
                        eval( `data = ${ d.slice( o, b ) };` );
                        tokens.push( { type: "JsonData", data, end: b } );
                    } catch ( e ) {
                        throw `In generator expression '${ d }', json data '${ d.slice( o, b ) }' is malformed: ${ e.toString() }`;
                    }
                    break;
                }
                case '(':
                    tokens.push( { type: "OpeningPar", beg: b++ } );
                    break;
                case ')':
                    tokens.push( { type: "ClosingPar", end: ++b } );
                    break;
                case ' ':
                case '\t':
                    ++b;
                    break;
                default:
                    const o = b;
                    while( ++b < e && ` \t'"(){}`.indexOf( d[ b ] ) < 0 );
                    tokens.push( { type: "Target", name: d.slice( o, b ) } );
                    break;
            }
        }
        
        // assemble
        let json_data = {} as any;
        for( let n = 0; n < tokens.length; ++n ) {
            if ( tokens[ n ].type == "ClosingPar" ) {
                if ( n + 1 < tokens.length ) {
                    const nt = tokens[ n + 1 ];
                    if ( nt.type != "JsonData" )
                        throw `In generator expression ('${ d }'), the () expression is followed by something that is not Json data`;
                    if ( n + 2 < tokens.length )
                        throw `In generator expression ('${ d }'), the () expression is followed by several tokens (it should be at most one)`;
                    json_data = nt.data;
                }                
                tokens.length = n;
                break;
            }

            if ( tokens[ n ].type == "OpeningPar" ) {
                let b = n, nb = 1;
                while ( true ) {
                    if ( ++n == tokens.length )
                        throw `In generator expression ('${ d }'), there is a non closed '('`;
                    if ( tokens[ n ].type == "OpeningPar" ) {
                        ++nb;
                    } else if ( tokens[ n ].type == "ClosingPar" ) {
                        if ( --nb == 0 )
                            break;
                    } 
                }
                if ( n + 1 < tokens.length && tokens[ n + 1 ].type == "JsonData" )
                    ++n;
                tokens.splice( b, n + 1 - b, { type: "SubExpr", expr: d.slice( ( tokens[ b ] as OpeningPar ).beg, ( tokens[ n ] as ClosingPar | JsonData ).end ) } );
                n = b;
                continue;
            }
        }

        return { json_data, tokens };
    }

    _parse_json( d: string, b: number, e: number ): number {
        let nbo = 1;
        while ( b < e ) {
            // string 1
            if ( d[ b ] == '"' ) {
                while( ++b < e ) {
                    if ( d[ b ] == '\\' ) { if ( ++b >= e ) break; }
                    else if ( d[ b ] == '"' ) break;
                }
                if ( b < e ) ++b;
                continue;
            }
            
            // string 2
            if ( d[ b ] == "'" ) {
                while( ++b < e ) {
                    if ( d[ b ] == '\\' ) { if ( ++b >= e ) break; }
                    else if ( d[ b ] == "'" ) break;
                }
                if ( b < e ) ++b;
                continue;
            }
            
            // {
            if ( d[ b ] == '{' ) {
                ++b;
                ++nbo;
                continue;
            }
            
            // }
            if ( d[ b ] == '}' ) {
                ++b;
                if ( --nbo == 0 )
                    return b;
                continue;
            }
            
            // default
            ++b;
        }
        return b;
    }
}
