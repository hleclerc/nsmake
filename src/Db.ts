// import * as rimraf from "rimraf";
// import * as crypto from "crypto";
// import * as async  from "async";
// import * as path   from "path";
// import * as fs     from "fs";

// function md5( str ) {
//     return crypto.createHash( 'md5' ).update( str ).digest( "hex" );
// }

// function mkdir_rec( dir : string ) {
//     if ( ! fs.existsSync( dir ) ) {
//         let p = path.dirname( dir );
//         if ( p != dir )
//             mkdir_rec( p );
//         fs.mkdirSync( dir );
//     }
// }

// export default
// class Db {
//     constructor( dir ) {
//         this.dir = dir;
//         this.init();
//     }

//     // callback( err, value: string )
//     get( key: string, callback, _num = 0 ) : void {
//         fs.readFile( `${ this.dir }/${ md5( key ) }_${ _num }.nsmake_cmd`, ( err, content: Buffer ) => {
//             if ( err )
//                 return callback( { notFound: true }, undefined );
//             const ind = content.indexOf( '\n' ), f_key = content.slice( 0, ind ).toString( 'utf8' );
//             if ( f_key != key )
//                 return this.get( key, callback, ++_num );
//             callback( null, content.slice( ind + 1 ).toString( 'utf8' ) );
//         } );
//     }

//     // callback( err )
//     put( key: string, value: string, callback, _num = 0 ) : void {
//         const fn = `${ this.dir }/${ md5( key ) }_${ _num }.nsmake_cmd`;
//         fs.readFile( fn, ( err, content: Buffer ) => {
//             if ( err )
//                 return fs.writeFile( fn, key + "\n" + value, callback );
//             const ind = content.indexOf( '\n' ), f_key = content.slice( 0, ind ).toString( 'utf8' );
//             if ( f_key != key )
//                 return this.put( key, value, callback, ++_num );
//             fs.writeFile( fn, key + "\n" + value, callback );
//         } );
//     }

//     //
//     clean( done ) {
//         try {
//             rimraf( this.dir, err => {
//                 done();
//             } );
//         } catch ( e ) {
//         }
//     }

//     init() {
//         mkdir_rec( this.dir );
//     }

//     remove( cond: ( key: string, val: string ) => boolean, end_cb: ( err: Error ) => void ) {
//         fs.readdir( this.dir, ( err, files ) => {
//             if ( err )
//                 return end_cb( err );
//             async.forEach( files, ( file, fe_cb ) => {
//                 if ( path.extname( file ) != ".nsmake_cmd" )
//                     return fe_cb( null );
//                 const comp_file = path.resolve( this.dir, file );
//                 fs.readFile( comp_file, ( err, content: Buffer ) => {
//                     if ( err ) return end_cb( err );
//                     const spl = content.toString().split( "\n" );
//                     cond( spl[ 0 ], spl[ 1 ] ) ? rimraf( comp_file, fe_cb ) : fe_cb( null );
//                 } );
//             }, end_cb );
//         } );
//     }

//     dir : string;
// }

// levelup version
import * as path from "path";
var leveldown = require( "leveldown" );
var levelup   = require( "levelup" );

export default
class Db {
    constructor( dir ) {
        this.dir = dir;
        this.init();
    }

    /** */
    get( key: string, callback: ( err, value: string ) => void ) {
        this.inst.get( key, callback );
    }

    /** */
    put( key: string, value, callback: ( err ) => void ) {
        this.inst.put( key, value, callback );
    }

    //
    clean( done ) {
        leveldown.destroy( path.resolve( this.dir, "commands" ), done );
        this.init();
    }

    init() {
        this.inst = levelup( leveldown( path.resolve( this.dir, "commands" ) ) );
    }

    remove( cond: ( key: string, val: string ) => boolean, end_cb: ( err: Error ) => void ) {
        // get a list of keys to delete
        let to_del = new Array<any>();
        this.inst.createReadStream().on( 'data', data => {
            if ( cond( data.key.toString(), data.value.toString() ) )
                to_del.push( data.key );
        } ).on( 'close', () => {
            // delete items in the list
            let b = this.inst.batch();
            to_del.forEach( key => b.del( key ) );
            b.write( end_cb );
        } );
    }

    dir : string;
    inst: any; // levelup
}
