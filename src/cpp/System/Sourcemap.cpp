#include "Sourcemap.h"
#include "Parsing.h"
#include <sstream>

static void vlq( std::ostream &os, unsigned &old_val, unsigned new_val, bool first = false ) {
    static const char *base64_i2c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    if ( first )
        old_val = 0;
    int val = new_val < old_val ? ( ( old_val - new_val ) << 1 ) + 1 : ( new_val - old_val ) << 1;
    old_val = new_val;

    for( ; val >= 32; val >>= 5 )
        os << base64_i2c[ 32 + val % 32 ];
    os << base64_i2c[ val ];
}

Sourcemap::Sourcemap() {
    gl = 0;
    gc = 0;
}

void Sourcemap::add_entry( const std::string &filename, const char *&lwe, unsigned &cl, unsigned &cc, const char *pos, bool reg ) {
    for( ; lwe < pos; ++lwe ) {
        if ( *lwe == '\n' ) {
            cc = 0;
            gc = 0;
            ++cl;
            ++gl;
        } else if ( *lwe != '\r' ) {
            ++cc;
            ++gc;
        }
    }

    if ( reg ) {
        Entry entry;
        entry.gl = gl;
        entry.gc = gc;
        entry.ol = cl;
        entry.oc = cc;
        entry.of = filenum( filename );

        entries.push_back( entry );
    }
}

void Sourcemap::write_to_stream( const std::string &filename, std::ostream &os ) const {
    // ts
    // {"version":3,"file":"baz.js","sourceRoot":"","sources":["baz.ts"],"names":[],"mappings":"AAEA,mCAAmC;AACnC,OAAO,CAAC,GAAG,CAAC,IAAI,CAAC,CAAC"}
    // os << "{\"version\":3,\"file\":\"" << filename << "\",\"sourceRoot\":\"\",\"names\":[],\"sources\": [";
    std::string dir = dirname( filename );
    os << "{\"version\":3,\"file\":\"" << relative_to( dir, filename ) << "\",\"names\":[],\"sources\": [";
    for( unsigned cpt = 0; cpt < ori_files.size(); ++cpt )
        os << ( cpt ? "," : "" ) << '"' << relative_to( dir, ori_files[ cpt ] ) << '"';
    os << "],\"mappings\":\"";

    // entries
    unsigned old_gl = 0;
    unsigned old_gc = 0;
    unsigned old_of = 0;
    unsigned old_ol = 0;
    unsigned old_oc = 0;
    for( const Entry &entry : entries ) {
        bool new_line = false;
        if ( old_gl < entry.gl ) {
            for( ; old_gl < entry.gl; ++old_gl )
                os << ";";
            new_line = true;
        } else if ( &entry != entries.data() )
            os << ",";

        vlq( os, old_gc, entry.gc, new_line );
        vlq( os, old_of, entry.of );
        vlq( os, old_ol, entry.ol );
        vlq( os, old_oc, entry.oc );
    }

    os << "\"}\n";
}

unsigned Sourcemap::filenum( const std::string &filename ) {
    for( unsigned i = 0; i < ori_files.size(); ++i )
        if ( ori_files[ i ] == filename )
            return i;
    unsigned res = ori_files.size();
    ori_files.push_back( filename );
    return res;
}

std::string Sourcemap::str( const std::string &filename ) {
    std::ostringstream ss;
    write_to_stream( filename, ss );
    return ss.str();
}
