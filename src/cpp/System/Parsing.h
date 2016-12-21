#ifndef PARSING_H
#define PARSING_H

#include <algorithm>
#include <iostream>
#include <vector>
#include <string>
#include "Trie.h"

inline bool              beg_var                  ( char c ) { return ( c >= 'a' and c <= 'z' ) or ( c >= 'A' and c <= 'Z' ) or c == '_' or (signed char)c < 0; }
inline bool              cnt_var                  ( char c ) { return beg_var( c ) or ( c >= '0' and c <= '9' ); }
inline bool              beg_num                  ( char c ) { return c >= '0' and c <= '9'; }
inline bool              hexa                     ( char c ) { return ( c >= '0' and c <= '9' ) or ( c >= 'a' and c <= 'f' ) or ( c >= 'A' and c <= 'F' ); }
inline bool              cnt_num                  ( char c ) { return cnt_var( c ); }
inline bool              hspace                   ( char c ) { return c == ' ' or c == '\t'; }
inline bool              space                    ( char c ) { return c == ' ' or c == '\t' or c == '\n' or c == '\r'; }
inline void              trim                     ( const char *&b, const char *&e ) { while ( b < e and space( *b ) ) ++b; while ( b < e and space( e[ -1 ] ) ) --e; }
std::string              trim_str                 ( const char *b, const char *e );
int                      num_line                 ( const char *beg, const char *pos );

void                     replace_all              ( std::string &str, const std::string &from, const std::string &to );

std::string              remove_quotes            ( const char *&b, const char *end, bool return_at_first_ending = false );
std::string              remove_quotes            ( const std::string &str, bool return_at_first_ending = false );
std::string              remove_quotes_if         ( const std::string &str, bool *has_quotes = nullptr );
bool                     skipe_spaces_and_comments( unsigned *lb, const char *&b, const char *e );
std::string              sp_encoded               ( const std::string &str );
std::string              sp_decoded               ( const std::string &str );
std::string              read_sized               ();
void                     write_file               ( const std::string &filename, const std::string &content );

void                     apply_on_vars            ( const char *b, const char *e, const Trie &trie, std::function<void( const char *b, const char *&e, const char *&f, unsigned num_var_type )> f, bool want_preproc = true );

template<class Op> void  read_variable            ( unsigned *lb, const char *&b, const char *e, const Trie &special_variables, const Op &op, bool skip_sp_com = true ); // op( leaf_val ). called with leaf_val == 0 if not in trie

std::string              content_of               ( const std::string &filename );

std::string              dirname                  ( const std::string &filename );
bool                     is_absolute              ( const std::string &filename );
std::string              relative_to              ( const std::string &dir, const std::string &filename );

std::vector<std::string> split                    ( const std::string &str, char sep );
std::string              join                     ( const std::vector<std::string> &str, const std::string &sep );
std::string              resolve                  ( const std::string &a, const std::string &b );

template<class L,class T>
void push_back_unique( L &lst, T &&val ) { // TODO: tidying up (place relevant stuff in relevant files, ...)
    if ( std::find( lst.begin(), lst.end(), val ) == lst.end() )
        lst.emplace_back( std::move( val ) );
}

// implementation --------------
template<class Op>
void read_variable( unsigned *lb, const char *&b, const char *e, const Trie &special_variables, const Op &op, bool skip_sp_com ) {
    if ( skip_sp_com )
        skipe_spaces_and_comments( lb, b, e );

    if ( const Trie *t = special_variables.next( *b ) ) {
        while ( true ) {
            if ( ++b >= e or not cnt_var( *b ) )
                return op( t->leaf_val );
            if ( not ( t = t->next( *b ) ) ) {
                while ( ++b < e and cnt_var( *b ) );
                break;
            }
        }
    } else {
        while ( ++b < e and cnt_var( *b ) );
    }

    op( 0 );
}


inline bool pre_inc_utf8( unsigned *n, const char *&b, const char *e ) {
    if ( n )
        ++*n;
    if ( (unsigned char)*b <= 0x7F ) return ( b += 1 ) < e;
    if ( (unsigned char)*b <= 0xC2 ) return ( b += 2 ) < e;
    if ( (unsigned char)*b <= 0xE0 ) return ( b += 3 ) < e;
    return ( b += 4 ) < e;
}

#endif // PARSING_H
