#pragma once

#include <string.h>
#include <memory>
#include <string>

/**
  Simple trie implementation
*/
class Trie {
public:
    Trie() : leaf_val( 0 ) {
    }

    void append( const char *b, const char *e, unsigned val ) {
        if ( b == e ) {
            leaf_val = val;
        } else {
            unsigned c = unsigned( *b ) % 128;
            if ( not children[ c ] )
                children[ c ].reset( new Trie );
            children[ c ]->append( ++b, e, val );
        }
    }

    void append( const char *b, unsigned val ) {
        append( b, b + strlen( b ), val );
    }

    void append( const std::string b, unsigned val ) {
        append( b.data(), b.data() + b.size(), val );
    }

    unsigned find( const char *b, const char *e ) const {
        if ( b == e )
            return leaf_val;
        unsigned c = unsigned( *b ) % 128;
        return children[ c ] ? children[ c ]->find( ++b, e ) : 0;
    }

    unsigned find( const std::string &str ) const {
        return find( str.data(), str.data() + str.size() );
    }

    Trie *next( unsigned c ) const {
        return children[ c % 128 ].get();
    }

    std::unique_ptr<Trie> children[ 128 ];
    unsigned              leaf_val;
};
