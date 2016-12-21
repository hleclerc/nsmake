#include "Parsing.h"
#include "Print.h"
#include <fstream>

std::string remove_quotes( const char *&b, const char *end, bool return_at_first_ending ) {
    std::string res;
    if ( end - b < 32 )
        res.reserve( end - b );
    while( b < end ) {
        if ( *b == '"' or *b == '\'' ) {
            char bc = *b;
            while ( ++b < end ) {
                if ( *b == '\\' ) {
                    if ( ++b == end ) {
                        res += '\\';
                        break;
                    }

                    switch ( *b ) {
                    case '0': case '1': case '2': case '3': case '4':
                    case '5': case '6': case '7': case '8': case '9': {
                        unsigned char num = *b - '0';
                        for( auto e = b + 3; ++b < e and beg_num( *b );  )
                            num = 10 * num + *b - '0';
                        res += (char )num;
                        --b;
                        break;
                    }
                    case 'x' : {
                        auto from_hex = []( char c ) -> unsigned char {
                            if ( c >= '0' and c <= '9' ) return c - '0';
                            if ( c >= 'a' and c <= 'f' ) return 10 + c - 'a';
                            if ( c >= 'A' and c <= 'F' ) return 10 + c - 'A';
                            return c;
                        };
                        unsigned char num = 0;
                        for( auto e = b + 3; ++b < e and hexa( *b ); )
                            num = 16 * num + from_hex( *b );
                        res += (char )num;
                        --b;
                        break;

                    }
                    case 'a' : res += '\a'; break;
                    case 'b' : res += '\b'; break;
                    case 'f' : res += '\f'; break;
                    case 'n' : res += '\n'; break;
                    case 'r' : res += '\r'; break;
                    case 't' : res += '\t'; break;
                    case 'v' : res += '\v'; break;
                    case '\\': res += '\\'; break;
                    case '\'': res += '\''; break;
                    case '"' : res += '\"'; break;
                    case '?' : res += '\?'; break;
                    default:
                        res += '\\';
                        res += *b;
                        break;
                    }

                    continue;
                }

                if ( *b == bc ) {
                    if ( return_at_first_ending ) {
                        ++b;
                        return res;
                    }
                    break;
                }

                res += *b;
            }
            if ( b < end )
                ++b;
            continue;
        }

        ++b;
    }
    return res;
}

std::string remove_quotes( const std::string &str, bool return_at_first_ending ) {
    const char *b = str.data();
    return remove_quotes( b, b + str.size(), return_at_first_ending );
}

std::string remove_quotes_if( const std::string &str, bool *has_quotes ) {
    const char *b = str.data(), *e = str.data() + str.size();
    trim( b, e );
    if ( b < e and ( *b == '"' or *b == '\'' ) ) {
        if ( has_quotes )
            *has_quotes = true;
        return remove_quotes( b, e );
    }
    if ( has_quotes )
        *has_quotes = false;
    return { b, e };
}

bool skipe_spaces_and_comments( unsigned *lb, const char *&b, const char *e ) {
    while ( true ) {
        if ( b >= e )
            return false;

        if ( space( *b ) ) {
            ++b;
            if ( lb )
                ++*lb;
            continue;
        }

        if ( *b == '/' and b + 1 < e ) {
            // /*
            if ( b[ 1 ] == '*' ) {
                if ( ( b += 2 ) < e ) {
                    while ( pre_inc_utf8( lb, b, e ) and ( b[ -1 ] != '*' or b[ 0 ] != '/' ) );
                    if ( b < e ) pre_inc_utf8( lb, b, e );
                }
                continue;
            }
            // //
            if ( b[ 1 ] == '/' ) {
                pre_inc_utf8( lb, b, e );
                while ( pre_inc_utf8( lb, b, e ) and *b != '\n' );
                continue;
            }
        }

        break;
    }
    return true;
}

std::string sp_encoded( const std::string &str ) {
    std::string res; res.reserve( str.size() );
    for( char c : str ) {
        switch( c ) {
        case '\\': res += "\\\\"; break;
        case '\n': res += "\\n";  break;
        case ' ' : res += "\\s" ; break;
        default  : res += c;
        }
    }
    return res;
}

std::string sp_decoded( const std::string &str ) {
    std::string res; res.reserve( str.size() );
    for( unsigned i = 0; i < str.size(); ++i ) {
        if ( str[ i ] == '\\' && i + 1 < str.size() ) {
            switch( str[ i + 1 ] ) {
            case '\\': res += '\\'; ++i; break;
            case 'n' : res += '\n'; ++i; break;
            case 's' : res += ' ' ; ++i; break;
            }
        } else
            res += str[ i ];
    }
    return res;
}


std::string read_sized() {
    P( "bim" );
    unsigned n;
    std::cin >> n;
    std::cin.get();

    std::string res;
    res.resize( n );
    std::cin.read( (char *)res.data(), n );
    return res;
}

void write_file( const std::string &filename, const std::string &content ) {
    std::ofstream fout( filename.c_str() ); // write the content
    fout << content;
}

void apply_on_vars( const char *b, const char *e, const Trie &trie, std::function<void (const char *, const char *&, const char *&, unsigned)> op, bool want_preproc ) {
    while( b < e ) {
        // variable
        if ( beg_var( *b ) ) {
            const char *o = b;
            read_variable( 0, b, e, trie, [&]( unsigned leaf_val ) {
                op( o, b, e, leaf_val );
            }, false );
            continue;
        }

        // number
        if ( beg_num( *b ) ) {
            // hexa
            if ( *b == '0' and b + 1 < e and ( b[ 1 ] == 'x' or b[ 1 ] == 'X' ) ) {
                pre_inc_utf8( 0, b, e );
                while ( ++b < e and cnt_var( *b ) );
                continue;
            }
            // deci
            while ( ++b < e and beg_num( *b ) );
            if ( b < e and *b == '.' ) ++b;
            while ( b < e and beg_num( *b ) ) ++b;
            if ( b < e and ( *b == 'e' or *b == 'E' ) ) ++b;
            if ( b < e and *b == '-' ) ++b;
            while ( b < e and cnt_var( *b ) ) ++b;
            continue;
        }

        // comment
        if ( *b == '/' ) {
            if ( b + 1 < e ) {
                if ( b[ 1 ] == '/' ) {
                    ++b;
                    while ( ++b < e and *b != '\n' );
                    continue;
                }
                if ( b[ 1 ] == '*' ) {
                    if ( ( b += 2 ) < e ) {
                        while ( ++b < e and ( b[ -1 ] != '*' or b[ 0 ] != '/' ) );
                        if ( b < e ) ++b;
                    }
                    continue;
                }
            }
        }

        // preprocessor
        if ( want_preproc and *b == '#' ) {
            bool cnt_line = false;
            while ( ++b < e ) {
                if ( *b == '\n' ) {
                    if ( not cnt_line )
                        break;
                    cnt_line = false;
                } else if ( *b == '\\' ) {
                    cnt_line = true;
                } else if ( *b != ' ' and *b != '\t' )
                    cnt_line = false;
            }
            continue;
        }

        // string
        if ( *b == '"' ) {
            while ( ++b < e ) {
                if ( *b == '\\' ) { if ( ++b == e ) break; }
                else if ( *b == '"' ) break;
            }
            if ( b < e ) ++b;
            continue;
        }

        // char
        if ( *b == '\'' ) {
            while ( ++b < e ) {
                if ( *b == '\\' ) { if ( ++b == e ) break; }
                else if ( *b == '\'' ) break;
            }
            if ( b < e ) ++b;
            continue;
        }

        // else
        ++b;
    }
}

std::string content_of( const std::string &filename ) {
    // read and parse the content.
    std::ifstream f( filename.c_str() );
    std::ostringstream ss;
    ss << f.rdbuf();

    return ss.str();
}

std::string trim_str(const char *b, const char *e) {
    trim( b, e );
    return { b, e };
}

int num_line( const char *beg, const char *pos ) {
    int res = 1;
    while ( --pos >= beg )
        res += ( *pos == '\n' );
    return res;
}

std::string dirname( const std::string &filename ) {
    auto ind = filename.rfind( '/' );
    if ( ind == std::string::npos )
        return "";
    return filename.substr( 0, ind );
}

std::string relative_to( const std::string &dir, const std::string &tgt ) {
    if ( tgt.empty() || tgt[ 0 ] != '/' ) return relative_to( dir, '/' + tgt );
    if ( dir.empty() || dir[ 0 ] != '/' ) return relative_to( '/' + dir, tgt );

    size_t ind_dir = dir.size();
    size_t ind_tgt = tgt.rfind( '/' );
    unsigned cpt_rewind = 0;
    while ( ind_dir != ind_tgt || strncmp( dir.data(), tgt.data(), ind_dir ) ) {
        if ( ind_dir > ind_tgt ) {
            ind_dir = dir.rfind( '/', ind_dir - 1 );
            ++cpt_rewind;
        } else if ( ind_dir < ind_tgt ) {
            ind_tgt = tgt.rfind( '/', ind_tgt - 1 );
        } else {
            ind_tgt = tgt.rfind( '/', ind_tgt - 1 );
            ind_dir = dir.rfind( '/', ind_dir - 1 );
            ++cpt_rewind;
        }
    }
    std::string res;
    while ( cpt_rewind-- )
        res += "../";
    return res + std::string( tgt.begin() + ind_tgt + 1, tgt.end() );
}


std::vector<std::string> split( const std::string &str, char sep ) {
    std::vector<std::string> res;
    std::istringstream is( str );
    std::string line;
    while( std::getline( is, line, sep ) )
        res.push_back( line );
    return res;
}



std::string join( const std::vector<std::string> &str, const std::string &sep ) {
    if ( str.empty() )
        return {};
    std::string res = str[ 0 ];
    for( unsigned i = 1; i < str.size(); ++i )
        res += sep + str[ i ];
    return res;
}

std::string resolve( const std::string &a, const std::string &b ) {
    return b.size() && b[ 0 ] == '/' ? b : a + "/" + b;
}

void replace_all( std::string &str, const std::string &from, const std::string &to ) {
    for( std::string::size_type ind = 0; ind < str.size(); ) {
        ind = str.find( from, ind );
        if ( ind == std::string::npos )
            return;
        str.replace( ind, from.size(), to );
        ind += to.size();
    }
}


bool is_absolute( const std::string &filename ) {
    return filename.size() && ( filename[ 0 ] == '/' || filename[ 0 ] == '\\' );
}
