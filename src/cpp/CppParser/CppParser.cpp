#include "../System/ErrorDisp.h"
#include "CppPreprocParser.h"
#include "CppParser.h"
#include <sys/stat.h>


CppParser::CppParser( Task *task, bool soTTY ): soTTY( soTTY ), task( task ) {
    special_variables.append( "NSMAKE_CMD"          , VT_NSMAKE_CMD       );
    special_variables.append( "NSMAKE_RUN"          , VT_NSMAKE_RUN       );
    special_variables.append( "defined"             , VT_defined          );
    special_variables.append( "__has_include__"     , VT_has_include      );
    special_variables.append( "__has_include"       , VT_has_include      );
    special_variables.append( "__has_include_next__", VT_has_include_next );
    special_variables.append( "__has_include_next"  , VT_has_include_next );

    defines[ VT_NSMAKE_CMD       ] = Define( "...", { "x" } );
    defines[ VT_NSMAKE_RUN       ] = Define( "...", { "x" } );
    defines[ VT_defined          ] = Define( "...", { "x" } );
    defines[ VT_has_include      ] = Define( "...", { "x" } );
    defines[ VT_has_include_next ] = Define( "...", { "x" } );

    macros_with_nsmake_cmd.insert( VT_NSMAKE_CMD );
    macros_with_nsmake_cmd.insert( VT_NSMAKE_RUN );

    num_special_var = VT_end_base;
    need_cpp_dump   = false;

    read_base_info();
    read_rules();
}

void CppParser::parse( const std::string &filename, const std::string &dir, const char *b, const char *e, Read *old_read, bool save, int num_path, bool no_comp ) {
    Read read( blocks.size() );
    read.num_read = old_read ? old_read->num_read + 1 : 0;
    read.num_path = num_path;
    read.filename = filename;
    read.prev     = old_read;
    read.no_comp  = no_comp;
    read.dir      = dir;
    read.lw       = b;
    read.b        = b;
    read.e        = e;

    // infinite recursion
    if ( read.num_read >= 100 )
        return c_error( "Infinite recursion", old_read->lw, old_read );

    // line maker
    if ( save and filename.size() ) {
        if ( cpp_content.size() && cpp_content.back() != '\n' )
            cpp_content += '\n';
        cpp_content += "# 1 \"" + filename + "\" 1" + ( is_system_header( filename ) ? " 3" : "" ) + '\n';
    }

    //
    while ( b < e ) {
        // variable
        if ( beg_var( *b ) ) {
            const char *o = b;
            read_variable( 0, b, e, special_variables, [&]( unsigned leaf_val ) {
                if ( leaf_val )
                    _variable( leaf_val, o, b, e, &read );
            }, false );
            ++read.num_inst;
            continue;
        }

        // number
        if ( beg_num( *b ) ) {
            ++read.num_inst;
            // hexa
            if ( *b == '0' and b + 1 < e and ( b[ 1 ] == 'x' or b[ 1 ] == 'X' ) ) {
                ++b;
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
                    const char *o = b;
                    while ( ++b < e and *b != '\n' );

                    if ( o + 2 < b and o[ 1 ] == '/' and o[ 2 ] == '/' ) {
                        o += 2;
                        while ( ++o < b and hspace( *o ) );
                        // nsmake ?
                        if ( o + 6 < b and strncmp( o, "nsmake", 6 ) == 0 and hspace( o[ 6 ] ) ) {
                            o += 6;
                            while ( ++o < b and hspace( *o ) );
                            _nsmake( o, b, &read );
                        }
                    }

                    continue;
                }
                if ( b[ 1 ] == '*' ) {
                    if ( ( b += 2 ) < e ) {
                        while ( ++b < e and ( b[ -1 ] != '*' or b[ 0 ] != '/' ) );
                        if ( b < e ) ++b;

                        // TODO: nsmake
                    }
                    continue;
                }
            }
        }

        // preprocessor
        if ( *b == '#' ) {
            const char *o = b;
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
            _preprocessor( o, b, &read );
            ++read.num_inst;
            continue;
        }

        // string
        if ( *b == '"' ) {
            while ( ++b < e ) {
                if ( *b == '\\' ) { if ( ++b == e ) break; }
                else if ( *b == '"' ) break;
            }
            if ( b < e ) ++b;
            ++read.num_inst;
            continue;
        }

        // char
        if ( *b == '\'' ) {
            while ( ++b < e ) {
                if ( *b == '\\' ) { if ( ++b == e ) break; }
                else if ( *b == '\'' ) break;
            }
            if ( b < e ) ++b;
            ++read.num_inst;
            continue;
        }

        // else
        if ( not space( *b ) )
            ++read.num_inst;
        ++b;
    }

    //
    if ( read.ifndef_string.empty() == false and
         read.define_string == read.ifndef_string and
         read.num_inst_endif + 1 == read.num_inst )
        can_be_skiped[ filename ] = read.ifndef_string;


    //
    if ( save ) {
        cpp_content.append( read.lw, e );

        // line maker
        if ( old_read and filename.size() ) {
            if ( cpp_content.size() && cpp_content.back() != '\n' )
                cpp_content += '\n';
            cpp_content += "# " + std::to_string( num_line( old_read->b, old_read->lw ) )
                        + " \"" + old_read->filename + "\" "
                        + '2'
                        + ( is_system_header( old_read->filename ) ? " 3" : "" )
                        + '\n';
        }
    }
}

void CppParser::parse( const std::string &filename, const std::string &dir, const std::string &str, Read *old_read, bool save, int num_path, bool no_comp ) {
    parse( filename, dir, str.data(), str.data() + str.size(), old_read, save, num_path, no_comp );
}

void CppParser::_nsmake( const char *b, const char *e, Read *read ) {
    if ( skip_inst() )
        return;
    include_cache.clear();

    // global flag ?
    std::vector<std::string> spl = split( { b, e }, ' ' );
    bool glob = false;
    if ( spl.size() && spl[ 0 ] == "global" ) {
        spl.erase( spl.begin(), spl.begin() + 1 );
        while ( spl.size() && spl[ 0 ].empty() )
            spl.erase( spl.begin(), spl.begin() + 1 );
        glob = true;
    }

    //
    std::vector<unsigned> nspl;
    for( unsigned i = 0; i < spl.size(); ++i )
        if ( spl[ i ].size() )
            nspl.push_back( i );
    if ( nspl.empty() )
        return;


    // to get trimmed end of line, starting from...
    auto cf = [&]( unsigned n ) { return n < nspl.size() ? join( { spl.begin() + nspl[ n ], spl.begin() + nspl[ nspl.size() - 1 ] + 1 }, " " ) : ""; };

    //
    if ( spl[ 0 ] == "alias" ) {
        if ( nspl.size() < 3 ) throw "'//// nsmake alias' is supposed to be followed by 2 arguments (key and value)";
        task->register_aliases( { std::make_pair( spl[ nspl[ 1 ] ], cf( 2 ) ) }, read->dir );
        return;
    }
    if ( spl[ 0 ] == "inc_path" ) {
        if ( nspl.size() < 2 ) throw "'//// nsmake inc_path' is supposed to be followed by 1 argument";
        if ( glob ) task->append_to_env_var( "include_path", cf( 1 ) );
        inc_paths.push_back( cf( 1 ) );
        return;
    }
    if ( spl[ 0 ] == "cpp_flag" ) {
        if ( nspl.size() < 2 ) throw "'//// nsmake cpp_flag' is supposed to be followed by 1 argument";
        if ( glob ) task->append_to_env_var( "cpp_flag", cf( 1 ) );
        cpp_flags.push_back( cf( 1 ) );
        return;
    }
    if ( spl[ 0 ] == "c_flag" ) {
        if ( nspl.size() < 2 ) throw "'//// nsmake c_flag' is supposed to be followed by 1 argument";
        if ( glob ) task->append_to_env_var( "c_flag", cf( 1 ) );
        c_flags.push_back( cf( 1 ) );
        return;
    }
    if ( spl[ 0 ] == "lib_path" ) {
        if ( nspl.size() < 2 ) throw "'//// nsmake lib_path' is supposed to be followed by 1 argument";
        lib_paths.push_back( cf( 1 ) );
        return;
    }
    if ( spl[ 0 ] == "lib_name" ) {
        if ( nspl.size() < 2 ) throw "'//// nsmake lib_name' is supposed to be followed by 1 argument";
        lib_names.push_back( cf( 1 ) );
        return;
    }
    if ( spl[ 0 ] == "lib_flag" ) {
        if ( nspl.size() < 2 ) throw "'//// nsmake lib_flag' is supposed to be followed by 1 argument";
        lib_flags.push_back( cf( 1 ) );
        return;
    }
    if ( spl[ 0 ] == "obj_name" ) {
        if ( nspl.size() < 2 ) throw "'//// nsmake obj_name' is supposed to be followed by 1 argument";
        obj_names.push_back( resolve( read->dir, cf( 1 ) ) );
        return;
    }
    if ( spl[ 0 ] == "cxx_name" ) {
        if ( nspl.size() < 2 ) throw "'//// nsmake cxx_name' is supposed to be followed by 1 argument";
        cxx_name = cf( 1 );
        return;
    }
    if ( spl[ 0 ] == "ld_name" ) {
        if ( nspl.size() < 2 ) throw "'//// nsmake ld_name' is supposed to be followed by 1 argument";
        ld_name = cf( 1 );
        return;
    }
    if ( spl[ 0 ] == "ar_name" ) {
        if ( nspl.size() < 2 ) throw "'//// nsmake ar_name' is supposed to be followed by 1 argument";
        ar_name = cf( 1 );
        return;
    }

    c_error( "'" + spl[ 0 ] + "' is not a known nsmake command", b, read );
    throw "";
}

void CppParser::_preprocessor( const char *b, const char *e, Read *read ) {
    const char *od = b;
    if ( b < e ) ++b; // skip the trailing #
    if ( not skipe_spaces_and_comments( 0, b, e ) ) return; // no instruction
    if ( beg_var( *b ) ) {
        const char *o = b;
        auto eq = [&]( const char *str ) {
            return size_t( b - o ) == strlen( str ) and strncmp( o, str, b - o ) == 0;
        };

        while ( ++b < e and cnt_var( *b ) );
        if ( eq( "define"       ) ) return _define ( b, e, read, od          );
        if ( eq( "ifdef"        ) ) return _ifdef  ( b, e, read, od, false   );
        if ( eq( "ifndef"       ) ) return _ifdef  ( b, e, read, od, true    );
        if ( eq( "if"           ) ) return _if     ( b, e, read, od          );
        if ( eq( "else"         ) ) return _else   ( read, od                );
        if ( eq( "elif"         ) ) return _elif   ( b, e, read, od          );
        if ( eq( "include_next" ) ) return _include( b, e, read, od, e, true );
        if ( eq( "include"      ) ) return _include( b, e, read, od, e       );
        if ( eq( "endif"        ) ) return _endif  ( read, od                );
        if ( eq( "undef"        ) ) return _undef  ( b, e, read, od          );
        if ( eq( "pragma"       ) ) return _pragma ( b, e, read, od          );
    }
}

void CppParser::_variable( unsigned variable_type, const char *b, const char *&e, const char *end, Read *read ) {
    if ( skip_inst() )
        return;

    if ( macros_with_nsmake_cmd.count( variable_type ) )
        write_substitution( variable_type, b, e, end, read );
}

void CppParser::c_error( const std::string &msg, const char *b, Read *read ) {
    ErrorDisp ed( msg, soTTY );
    for( Read *r = read; r; r = r->prev )
        ed.ac( r->b, r->e, r == read ? b : r->lw, r->filename );
    ed.write_to_stream( std::cerr );
    std::cerr << std::endl;
}

bool CppParser::get_macro_arguments( const char *&b, const char *e, std::vector<std::pair<const char *,const char *>> &arguments, Read *read ) {
    // find the '('
    if ( not skipe_spaces_and_comments( 0, b, e ) or *b != '(' )
        return false;

    // find the ')'
    const char *o = ++b;
    int opened_m1 = 0;
    while ( b < e ) {
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

        // opening parenthesis
        if ( *b == '(' ) {
            ++opened_m1;
            ++b;
            continue;
        }

        // closing parenthesis
        if ( *b == ')' ) {
            if ( --opened_m1 < 0 ) {
                const char *ba = o, *ea = b++;
                trim( ba, ea );
                arguments.emplace_back( ba, ea );
                return true;
            }
            ++b;
            continue;
        }

        // separator
        if ( *b == ',' and opened_m1 == 0 ) {
            const char *ba = o, *ea = b;
            trim( ba, ea );
            arguments.emplace_back( ba, ea );
            o = ++b;
            continue;
        }

        // else
        ++b;
    }

    return false;
}


bool CppParser::skip_inst() const {
    return blocks.empty() == false && blocks.top().ko();
}

std::string CppParser::substitution( const std::string &str, Read *read, const char *od ) {
    std::string res = str;

    // concatenation with ##
    for( std::string::size_type i = 1; i < res.size(); ) {
        if ( res[ i ] == '#' and res[ i - 1 ] == '#' ) {
            std::string::size_type b = i - 1, e = i + 1;
            while ( b and space( res[ b - 1 ] ) )
                --b;
            while ( e < res.size() and space( res[ e ] ) )
                ++e;
            res.erase( b, e - b );
        } else
            ++i;
    }

    //
    apply_on_vars( res.data(), res.data() + res.size(), special_variables, [&]( const char *b, const char *&e, const char *&f, unsigned num_var_type ) {
        auto iter = defines.find( num_var_type );
        if ( iter != defines.end() ) {
            //
            auto repl = [&]( const std::string &subs ) {
                const char *o = res.data();
                res.replace( b - o, e - b, subs );
                auto d = res.data() - o + subs.size() - ( e - b );
                e += d;
                f += d;
            };

            // need a '(' ?
            if ( iter->second.need_p ) {
                // no '(' ?
                if ( not skipe_spaces_and_comments( 0, e, res.data() + res.size() ) or *e != '(' ) {
                    if ( iter->first == VT_defined ) {
                        return read_variable( 0, e, res.data() + res.size(), special_variables, [&]( unsigned num_leaf ) {
                            repl( num_leaf && defines.count( num_leaf ) ? "1" : "0" );
                        } );
                    }
                    return c_error( "Macro " + std::string( b, e ) + " needs arguments but there is not", od, read );
                }

                // get the arguments
                std::vector<std::pair<const char *,const char *>> arguments;
                if ( not get_macro_arguments( e, res.data() + res.size(), arguments, read ) )
                    return c_error( "'(' does not seem to be closed (in '" + res + "')", od, read );

                // particular case 1: "defined"
                if ( iter->first == VT_defined ) {
                    if ( arguments.size() != 1 )
                        return c_error( "'defined' expects exactly one argument", od, read );
                    unsigned leaf_val = special_variables.find( arguments[ 0 ].first, arguments[ 0 ].second );
                    return repl( defines.count( leaf_val ) ? "1" : "0" );
                }

                // particular case 2: "__has_include"
                if ( iter->first == VT_has_include ) {
                    if ( arguments.size() != 1 )
                        return c_error( "'__has_include[__]' expects exactly one argument", od, read );
                    // send a request, wait for an answer
                    std::vector<std::string> to_try = include_try_list( read->dir, task->args[ "launch_dir" ].asString(), { arguments[ 0 ].first, arguments[ 0 ].second }, 0 );
                    Task::NumAndSignature nas = task->get_first_filtered_target_signature( to_try, read->dir );
                    return repl( nas ? "1" : "0" );
                }

                // particular case 3: "__has_include_next"
                if ( iter->first == VT_has_include_next ) {
                    if ( arguments.size() != 1 )
                        return c_error( "'__has_include_next[__]' expects exactly one argument", od, read );
                    // send a request, wait for an answer
                    std::vector<std::string> to_try = include_try_list( read->dir, task->args[ "launch_dir" ].asString(), { arguments[ 0 ].first, arguments[ 0 ].second }, get_num_path( read ) + 1 );
                    Task::NumAndSignature nas = task->get_first_filtered_target_signature( to_try, read->dir );
                    return repl( nas ? "1" : "0" );
                }

                // particular case 4: NSMAKE_CMD
                if ( iter->first == VT_NSMAKE_CMD ) {
                    if ( arguments.size() == 0 ) {
                        c_error( "'NSMAKE_CMD' expects at least one argument", od, read );
                        return;
                    }
                    std::vector<std::string> args;
                    for( const auto &p : arguments )
                         args.push_back( remove_quotes_if( { p.first, p.second } ) );
                    return repl( task->nsmake_cmd( args, read->dir ) );
                }

                // particular case 4: NSMAKE_RUN
                if ( iter->first == VT_NSMAKE_RUN ) {
                    if ( arguments.size() == 0 ) {
                        c_error( "'NSMAKE_RUN' expects at least one argument", od, read );
                        return;
                    }
                    std::vector<std::string> args;
                    for( const auto &p : arguments )
                        args.push_back( remove_quotes_if( { p.first, p.second } ) );
                    return repl( task->nsmake_run( args, read->dir ) );
                }

                // else, regular substitution. First, argument prescan in iter->second.content
                const Define &define = iter->second;
                std::string content = define.content;

                // make a trie for each input variable
                Trie arg_trie;
                for( unsigned i = 0; i < define.variables.size(); ++i ) {
                    if ( define.variables[ i ] == "..." )
                        arg_trie.append( "__VA_ARGS__", 1 );
                    else
                        arg_trie.append( define.variables[ i ], 2 + i );
                }

                apply_on_vars( content.data(), content.data() + content.size(), arg_trie, [&]( const char *b, const char *&e, const char *&f, unsigned num_var_type ) {
                    if ( ! num_var_type )
                        return;

                    // helpers
                    auto repl = [&]( const std::string &subs ) {
                        const char *o = content.data();
                        content.replace( b - o, e - b, subs );
                        auto d = content.data() - o + subs.size() - ( e - b );
                        e += d;
                        f += d;
                    };
                    auto want_stringification = [&]( const char *&sb ) {
                        while ( sb-- > content.data() ) {
                            if ( *sb == '#' )
                                return sb == content.data() or sb[ -1 ] != '#';
                            if ( not space( *sb ) )
                                return false;
                        }
                        return false;
                    };
                    auto pd_b = [&]( const char *b ) {
                        while ( b-- ) {
                            if ( *b == '#' )
                                return b > content.data() and b[ -1 ] == '#';
                            if ( not space( *b ) )
                                return false;
                        }
                        return false;
                    };
                    auto pd_e = [&]( const char *e ) {
                        while ( ++e < content.data() + content.size() ) {
                            if ( e[ -1 ] == '#' and *e == '#' )
                                return true;
                            if ( not space( e[ -1 ] ) )
                                return false;
                        }
                        return false;
                    };

                    // __VA_ARGS__ ?
                    if ( num_var_type == 1 ) {
                        // #__VA_ARGS__ ?
                        const char *ob = b;
                        if ( want_stringification( b ) ) {
                            if ( arguments.size() < define.variables.size() )
                                return repl( "\"\"" );
                            return repl( '"' + stringified( { arguments[ define.variables.size() - 1 ].first, arguments.back().second } ) + '"' );
                        }
                        b = ob;

                        // remove a potential leading ',' if no var
                        if ( arguments.size() < define.variables.size() ) {
                            while ( b > content.data() and hspace( b[ -1 ] ) ) --b;
                            if ( b > content.data() and b[ -1 ] == ',' ) --b;
                        }

                        //
                        std::string subs;
                        for( unsigned p = define.variables.size() - 1, i = p; i < arguments.size(); ++i ) {
                            if ( i != p ) subs += ",";
                            subs += substitution( std::string( arguments[ i ].first, arguments[ i ].second ), read, od );
                        }
                        return repl( subs );
                    }

                    // stringified ?
                    const char *ob = b;
                    auto arg = arguments[ num_var_type - 2 ];
                    if ( want_stringification( b ) )
                        return repl( '"' + stringified( { arg.first, arg.second } ) + '"' );
                    b = ob;

                    // pasted ?
                    if ( pd_b( b ) or pd_e( e ) )
                        return repl( { arg.first, arg.second } );

                    // else, complete macro expansion
                    return repl( substitution( { arg.first, arg.second }, read, od ) );
                }, false );

                return repl( substitution( content, read, od ) );
            }

            // else, simply put the content
            return repl( substitution( iter->second.content, read, od ) );
        }
    }, false );

    return res;
}

std::string CppParser::stringified( const std::string &s ) {
    std::string res;
    res.reserve( s.size() );
    for( unsigned i = 0; i < s.size(); ++i) {
        if ( space( s[ i ] ) and res.size() and space( res.back() ) )
            continue;
        if ( space( s[ i ] ) )
            res += ' ';
        else
            res += s[ i ];
    }
    return trim_str( res.data(), res.data() + res.size() );
}

int CppParser::get_num_path( const Read *read ) {
    for( ; read; read = read->prev )
        if ( read->num_path >= 0 )
            return read->num_path;
    return -1;
}

bool CppParser::is_system_header( const std::string &p ) const {
    for( const std::string &i : base_include_paths )
        if ( is_in( p, i ) )
            return true;
    return false;
}

bool CppParser::is_in( std::string file, const std::string &dir ) const {
    while ( file.size() > dir.size() ) {
        auto p = file.rfind( '/' );
        if ( p == std::string::npos )
            return false;
        file.resize( p );
    }
    return file == dir;
}

void CppParser::read_rules() {
    Json::Value data;
    Json::Reader reader;
    reader.parse( task->read_file_sync( task->children[ 1 ].outputs[ 0 ] ), data );
    for( Json::Value &item : data ) {
        if ( item[ "data" ].isNull() )
            continue;
        for( Json::Value &include : item[ "data" ][ "includes" ] ) {
            std::string str = include.asString();
            auto iter = inc_rules.find( str );
            if ( iter != inc_rules.end() )
                task->error( "Rule for include <" + str + "> appears twice in yaml rule files (" + item[ "name" ].asString() + " and " + iter->second[ "data" ].asString() + ")." );
            item[ "data" ][ "yaml_name" ] = item[ "name" ];
            inc_rules.insert( iter, std::make_pair( str, item[ "data" ] ) );
        }
    }
}

void CppParser::read_base_info() {
    // base includes
    base_include_paths = from_json( task->children[ 2 ].exe_data[ "inc_paths" ] );
    cmd_include_paths  = from_json( task->args[ "inc_paths" ] );

    // base defines
    std::string base_defines = task->children[ 2 ].exe_data[ "defines" ].asString();
    parse( "", "", base_defines );
    cpp_content.clear();
}

void CppParser::_include( const char *b, const char *e, Read *read, const char *od, const char *sd, bool next, bool subs_allowed ) {
    if ( skip_inst() )
        return;

    if ( not skipe_spaces_and_comments( 0, b, e ) )
        return c_error( "void #include", od, read );

    // need a substitution ?
    if ( subs_allowed and *b != '"' and *b != '<' ) {
        std::string str = substitution( { b, e }, read, b );
        return _include( str.data(), str.data() + str.size(), read, od, sd, next, false );
    }

    //
    if ( b == e )
        return c_error( "void filename", od, read );

    if ( *b == '<' ) {
        const char *oe = e;
        e = b;
        while ( ++e < oe and *e != '>' );
        e += ( e < oe );
    } else if ( *b == '"' ) {
        const char *oe = e;
        e = b;
        while ( ++e < oe and *e != '"' );
        e += ( e < oe );
    }

    //
    //        if ( *b == '<' ) {
    //            std::string trial = "/usr/include/" + std::string( b + 1, e - 1 );
    //            struct stat buf;
    //            if ( stat( trial.c_str(), &buf ) == 0 ) {
    //                std::string filename = trial, dir = std::string( trial.data(), trial.data() + trial.rfind( '/' ) );

    //                // have to be skiped ?
    //                if ( pragma_onced.count( filename ) )
    //                    return;
    //                auto iter = can_be_skiped.find( filename );
    //                if ( iter != can_be_skiped.end() and defines.count( special_variables.find( iter->second ) ) )
    //                    return;

    //                //
    //                return parse( filename, dir, content_of( filename ), read, true, 0 );
    //            }
    //        }

    // ask for the complete filename, parse the content
    bool no_comp = read->no_comp;
    int num_path, min_num_path = next ? get_num_path( read ) + 1 : 0;
    std::string filename, dir, key = std::string( b, e ) + "\n" + read->dir + "\n" + std::to_string( min_num_path );
    auto iter_cache = include_cache.find( key );
    if ( iter_cache != include_cache.end() ) {
        // in the cache
        filename = std::get<0>( iter_cache->second );
        dir      = std::get<1>( iter_cache->second );
        num_path = std::get<2>( iter_cache->second );
        no_comp |= std::get<3>( iter_cache->second );
    } else {
        // list of possibilities
        std::string inc_str{ b + 1, e - 1 };
        include_strs.insert( inc_str );

        // get signature
        std::vector<std::string> to_try = include_try_list( *b == '"' ? read->dir : "", task->args[ "launch_dir" ].asString(), inc_str, min_num_path, &no_comp );
        Task::NumAndSignature nas = task->get_first_filtered_target_signature( to_try, read->dir );
        if ( nas.signature.empty() ) {
            // try to load the library
            auto iter = inc_rules_find( inc_str );
            if ( iter != inc_rules.end() ) {
                const Json::Value &rules = iter->second[ "load_sets" ];
                if ( rules.isNull() ) {
                    c_error( "Error while trying to download lib: there is no 'load_set' attribute in file '" + iter->second[ "yaml_name" ].asString() + "'", b, read );
                    throw "";
                }
                auto ri = task->run_yaml_install_cmd( from_json( task->args[ "launch_dir" ] ), rules, task->args[ "system" ], true );
                if ( ri.first ) {
                    c_error( "Error while trying to download lib: " + ri.second, b, read );
                    throw "";
                }

                // try again
                nas = task->get_first_filtered_target_signature( to_try, read->dir );
            }

            // try again
            if ( nas.signature.empty() ) {
                std::string msg = "Impossible to find include " + std::string{ b, e };
                if ( iter != inc_rules.end() )
                    msg += ", even after use of download rules of '" + iter->second[ "yaml_name" ].asString() + "'";
                else
                    msg += " (and nothing was found in the rules/cpp/*.yaml files)";
                msg += ".";
                c_error( msg, od, read );

                msg = "(tried";
                for( std::string trial : to_try )
                    msg += " '" + trial + "'";
                msg += ").";
                task->announcement( msg );
                throw "";
            }
        }

        // make the CompilationNode
        Task::CnData cnd = task->get_cn_data( nas.signature );
        filename  = cnd.outputs[ 0 ];
        dir       = dirname( cnd.exe_data[ "orig_name" ].isNull() ? filename : cnd.exe_data[ "orig_name" ].asString() );
        num_path  = nas.num + min_num_path;

        // store the result in the cache
        if ( no_comp )
            no_comps.insert( filename );
        include_cache.insert( iter_cache, std::make_pair( key, std::make_tuple( filename, dir, num_path, no_comp ) ) );
        includes.insert( filename );
    }

    // write cpp_content seen so far
    cpp_content.append( read->lw, od );
    read->lw = sd;

    // have to be skiped ?
    if ( pragma_onced.count( filename ) )
        return;
    auto iter = can_be_skiped.find( filename );
    if ( iter != can_be_skiped.end() and defines.count( special_variables.find( iter->second ) ) )
        return;

    //
    parse( filename, dir, content_of( filename ), read, true, num_path, no_comp );
}

std::vector<std::string> CppParser::include_try_list( std::string cur_dir, std::string launch_dir, std::string basename, unsigned min_num_path, bool *no_comp ) {
    // absolute name
    std::vector<std::string> to_try;
    if ( is_absolute( basename ) ) {
        to_try.push_back( basename );
        return to_try;
    }

    // #include "..." => current directory
    if ( cur_dir.size() )
        to_try.push_back( cur_dir + "/" + basename );

    // there's a rule for this include ?
    auto iter = inc_rules_find( basename );
    if ( iter != inc_rules.end() ) {
        for( Json::Value set : iter->second[ "flag_sets" ] ) {
            if ( task->system_is_in( from_json( set[ "systems" ] ), task->args[ "system" ] ) ) {
                for( Json::Value inc_path : set[ "inc_paths" ] )
                    emplace_back_unique( inc_paths, resolve( launch_dir, inc_path.asString() ) );
                for( Json::Value lib_path : set[ "lib_paths" ] )
                    emplace_back_unique( lib_paths, resolve( launch_dir, lib_path.asString() ) );
                for( Json::Value lib_name : set[ "lib_names" ] )
                    emplace_back_unique( lib_names, lib_name.asString() );
                for( Json::Value cpp_flag : set[ "cpp_flags" ] )
                    emplace_back_unique( cpp_flags, cpp_flag.asString() );
                if ( no_comp && set[ "no_comp" ].asBool() )
                    *no_comp = true;
                break;
            }
        }
    }

    for( const std::string &dir : inc_paths )
        to_try.push_back( dir + "/" + basename );
    for( const std::string &dir : cmd_include_paths )
        to_try.push_back( dir + "/" + basename );
    for( const std::string &dir : base_include_paths )
        to_try.push_back( dir + "/" + basename );
    if ( min_num_path > 0 )
        return { to_try.begin() + min_num_path, to_try.end() };
    return to_try;
}

void CppParser::_endif( Read *read, const char *od ) {
    if ( blocks.empty() )
        return c_error( "#endif without #if, #ifdef or #ifndef", od, read );
    if ( blocks.size() == read->len_block_beg + 1 and read->num_inst_endif == std::numeric_limits<unsigned>::max() )
        read->num_inst_endif = read->num_inst;
    blocks.pop();
}

void CppParser::_ifdef( const char *b, const char *e, Read *read, const char *od, bool neg ) {
    if ( skip_inst() )
        return blocks.emplace( false, false, true );

    trim( b, e );
    if ( neg && read->num_inst == 0 )
        read->ifndef_string = { b, e };

    bool defined = false;
    read_variable( 0, b, e, special_variables, [&]( unsigned num_var ) {
        defined = num_var;
    } );

    bool res = defined ^ neg;
    blocks.emplace( res, res, false );
}

void CppParser::_if( const char *b, const char *e, Read *read, const char *od ) {
    if ( skip_inst() )
        return blocks.emplace( false, false, true );

    // need_cpp_dump ?
    apply_on_vars( b, e, special_variables, [&]( const char *vb, const char *&ve, const char *&vf, unsigned variable_type ) {
        if ( macros_with_nsmake_cmd.count( variable_type ) )
            write_substitution( variable_type, vb, ve, e, read );
    }, false );

    // define substitution
    skipe_spaces_and_comments( 0, b, e );
    std::string val = substitution( { b, e }, read, b );

    // evaluation of expression
    bool ok = false;
    CppPreprocParser cpc;
    cpc.parse( val.data(), val.data() + val.size() );
    if ( cpc.errors.empty() )
        ok = cpc.eval();
    else
        c_error( "Pb while parsing expression '" + val + "': " + cpc.errors.front().first, b, read );

    // new block
    blocks.emplace( ok, ok, false );
}

CppParser::MapSJV::iterator CppParser::inc_rules_find( const std::string &inc ) {
    CppParser::MapSJV::iterator res = inc_rules.find( inc );
    if ( res != inc_rules.end() )
        return res;
    // 'foo/bar/smurf.h' => try 'foo/bar/' (with the trailing '/')
    // 'foo/bar/' => try 'foo/' (with the trailing '/')
    size_t ind = inc.size() >= 2 ? inc.rfind( '/', inc.size() - 2 ) : std::string::npos;
    return ind != std::string::npos ? inc_rules_find( inc.substr( 0, ind + 1 ) ) : inc_rules.end();
}

void CppParser::_else( Read *read, const char *od ) {
    if ( blocks.empty() )
        return c_error( "#else without #if, #ifdef or #ifndef", od, read );

    Block &bl = blocks.top();
    if ( bl.has_ok )
        bl.cur_ok = false;
    else {
        bl.cur_ok ^= 1;
        bl.has_ok = 1;
    }
}

void CppParser::_elif( const char *b, const char *e, Read *read, const char *od ) {
    if ( blocks.empty() )
        return c_error( "#elif without #if, #ifdef or #ifndef", od, read );

    if ( blocks.top().sur_ko )
        return;
    if ( blocks.top().has_ok ) {
        blocks.top().cur_ok = false;
        return;
    }

    // need_cpp_dump ?
    apply_on_vars( b, e, special_variables, [&]( const char *vb, const char *&ve, const char *&vf, unsigned variable_type ) {
        if ( macros_with_nsmake_cmd.count( variable_type ) )
            write_substitution( variable_type, vb, ve, e, read );
    }, false );

    // define substitution
    skipe_spaces_and_comments( 0, b, e );
    std::string val = substitution( { b, e }, read, b );

    // evaluation of expression
    bool ok = false;
    CppPreprocParser cpc;
    cpc.parse( val.data(), val.data() + val.size() );
    if ( cpc.errors.empty() )
        ok = cpc.eval();
    else
        c_error( "Pb while parsing expression '" + val + "': " + cpc.errors.front().first, b, read );

    // block update
    blocks.top().cur_ok = ok;
    blocks.top().has_ok = ok;
}

void CppParser::_define( const char *b, const char *e, Read *read, const char *od ) {
    if ( skip_inst() )
        return;

    // parse
    if ( not skipe_spaces_and_comments( 0, b, e ) )
        return;

    // -> var
    const char *o = b;
    while ( ++b < e and cnt_var( *b ) );
    std::string var( o, b );

    // can_be_skiped
    if ( read->num_inst == 1 )
        read->define_string = var;

    // -> args
    Define d;
    if ( b < e and *b == '(' ) {
        d.need_p = true;
        o = b + 1;
        while ( ++b < e ) {
            if ( *b == ',' or *b == ')' ) {
                const char *m = b;
                trim( o, m );
                if ( m != o )
                    d.variables.emplace_back( o, m );
                if ( *b == ')' ) {
                    ++b;
                    break;
                }
                o = b + 1;
            }
        }
    }

    // content
    d.content.reserve( e - b );
    while( b < e ) {
        // comment
        if ( *b == '/' and b + 1 < e and b[ 1 ] == '*' ) {
            if ( d.content.empty() or not hspace( d.content.back() ) )
                d.content.push_back( ' ' );
            if ( ( b += 2 ) < e ) {
                while ( ++b < e and ( b[ -1 ] != '*' or b[ 0 ] != '/' ) );
                if ( b < e ) ++b;
            }
            continue;
        }

        // string
        if ( *b == '"' ) {
            d.content.push_back( *b );
            while ( ++b < e ) {
                d.content.push_back( *b );
                if ( *b == '\\' ) { if ( ++b == e ) break; d.content.push_back( *b ); }
                else if ( *b == '"' ) break;
            }
            if ( b < e ) ++b;
            continue;
        }

        // char
        if ( *b == '\'' ) {
            d.content.push_back( *b );
            while ( ++b < e ) {
                d.content.push_back( *b );
                if ( *b == '\\' ) { if ( ++b == e ) break; d.content.push_back( *b ); }
                else if ( *b == '\'' ) break;
            }
            if ( b < e ) ++b;
            continue;
        }

        // continuation
        if ( *b == '\\' and b + 1 < e and ( b[ 1 ] == '\n' or b[ 1 ] == '\r' ) ) {
            ++b;
            continue;
        }

        // space
        if ( space( *b ) ) {
            if ( d.content.size() and d.content.back() != ' ' )
                d.content.push_back( ' ' );
            ++b;
            continue;
        }

        // else
        d.content.push_back( *b );
        ++b;
    }
    if ( d.content.size() and space( d.content.back() ) )
        d.content.pop_back();


    // store the key
    unsigned n = num_special_var++;
    special_variables.append( var.data(), var.data() + var.size(), n );

    // macros_with_nsmake_cmd ?
    apply_on_vars( d.content.data(), d.content.data() + d.content.size(), special_variables, [&]( const char *vb, const char *&ve, const char *&vf, unsigned num_var ) {
        if ( macros_with_nsmake_cmd.count( num_var ) ) {
            macros_with_nsmake_cmd.insert( n );
        }
    }, false );

    // store the define
    defines.emplace( n, std::move( d ) );
}

void CppParser::_undef( const char *b, const char *e, Read *read, const char *od ) {
    if ( skip_inst() )
        return;
    read_variable( 0, b, e, special_variables, [&]( unsigned leaf_val ) {
        if ( leaf_val ) {
            macros_with_nsmake_cmd.erase( leaf_val );
            defines.erase( leaf_val );
        }
    } );
}

void CppParser::_pragma( const char *b, const char *e, Read *read, const char *od ) {
    if ( skip_inst() )
        return;

    // parse first argument
    skipe_spaces_and_comments( 0, b, e );
    const char *o = b;
    while ( b < e and cnt_var( *b ) ) ++b;

    // pragma once ?
    if ( b - o == 4 and strncmp( o, "once", 4 ) == 0 )
        pragma_onced.insert( read->filename );
}

void CppParser::write_substitution( unsigned variable_type, const char *b, const char *&e, const char *end, Read *read ) {
    // read arguments if necessary (update `e`)
    if ( defines[ variable_type ].need_p ) {
        std::vector<std::pair<const char *,const char *>> arguments;
        get_macro_arguments( e, end, arguments, read );
    }

    // write what we have seen so far
    cpp_content.append( read->lw, b );
    read->lw = e;

    // line maker in the line before
    if ( read->filename.size() ) {
        auto ind = cpp_content.rfind( '\n' ) + 1;
        std::string str = "# " + std::to_string( num_line( cpp_content.data(), cpp_content.data() + ind ) + 1 ) + " \"@@__generated_from_NSMAKE_xxx__@@\"\n";
        cpp_content.insert( ind, str );

        for( unsigned i = linemakers_to_insert.size(); i-- and linemakers_to_insert[ i ].first >= ind; )
            linemakers_to_insert[ i ].first += str.size();
    }

    // parse substitution
    std::string subs = substitution( { b, e }, read, b );
    parse( "", read->dir, subs, read );
    need_cpp_dump = true;

    // line maker, to restart in orig file
    if ( read->filename.size() )
        linemakers_to_insert.emplace_back( cpp_content.size(), "\n# " + std::to_string( num_line( read->b, read->lw ) + 1 ) + " \"" + read->filename + "\"" );
}
