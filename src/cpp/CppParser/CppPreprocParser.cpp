#include "CppPreprocParser.h"
#include <string.h>

bool CppPreprocParser::parse( const char *beg, const char *end ) {
    if ( parse( &hpipe_data, (const unsigned char *)beg, (const unsigned char *)end - 1 ) == RET_KO )
        return errors.emplace_back( "parsing error", 0 ), false;
    ast_data.beg = beg;
    ast_data.end = end;
    ast_data.cpp = this;
    ast_data.make_hierarchy();
    return true;
}

void CppPreprocParser::write_to_stream( std::ostream &os ) const {
    ast_data.base.next->write_to_stream( os );
}

CppPreprocParser::ST CppPreprocParser::eval() const {
    // PRINT( ast_data.base );
    //        auto res = ast_data.eval();
    //        PRINT( res );
    //        return res;
    return ast_data.eval();
    //    } catch ( const char * ) {
    //        std::cout << "------------------------------" << std::endl;
    //        std::cout << "  " << std::string( ast_data.beg, ast_data.end ) << std::endl;
    //        std::cout << "  " << *ast_data.base.next << std::endl;
    //        std::cout << "  " << ast_data.eval() << std::endl;
    //        throw "pouet";
    //    }
}

int CppPreprocParser::AstData::behavior( int grp ) {
    switch ( grp ) {
    case GRP_ADD_UNA: return need_rarg;
    case GRP_MUL:     return need_barg;
    case GRP_ADD:     return need_barg;
    case GRP_SHL:     return need_barg;
    case GRP_INF:     return need_barg;
    case GRP_EQU:     return need_barg;
    case GRP_AND_BIN: return need_barg;
    case GRP_XOR_BIN: return need_barg;
    case GRP_OR_BIN:  return need_barg;
    case GRP_AND_LOG: return need_barg;
    case GRP_OR_LOG:  return need_barg;
    case GRP_DBL_DOT: return need_barg;
    }
    return need_none;
}

CppPreprocParser::AstData::AstData() : base( BASE, 0 ), last( &base ) {
    for( int i = 0; i < nb_grp; ++i )
        by_grp[ i ] = 0;
}

void CppPreprocParser::AstData::reg( Node *node, int group ) {
    last->next = node;
    node->prev = last;
    last = node;

    if ( group >= 0 ) {
        if ( group == GRP_ADD and ( node->type == SUB or node->type == ADD ) ) {
            if ( node->prev->type != VARIABLE and node->prev->type != NUMBER and node->prev->type != RGT_PAR ) {
                node->type = ( node->type == SUB ? SUB_UNA : ADD_UNA );
                group = GRP_ADD_UNA;
            }
        }

        node->prev_grp = by_grp[ group ];
        by_grp[ group ] = node;

    }

    node->grp = group;
}

bool CppPreprocParser::AstData::err( Node *o, const std::string &msg ) {
    cpp->errors.emplace_back( msg, 0 );
    //    std::cerr << msg << std::endl;
    //    std::cerr << "  (while parsing '" << std::string( beg, end ) << "')" << std::endl;
    return false;
}

std::string CppPreprocParser::AstData::op_string( int num ) {
    switch ( num ) {
    case LFT_PAR   : return "(";
    case RGT_PAR   : return ")";
    case NUMBER    : return "NUMBER";
    case ADD_UNA   : return "+";
    case SUB_UNA   : return "-";
    case NOT_LOG   : return "!";
    case NOT_BIN   : return "~";
    case MUL       : return "*";
    case DIV       : return "/";
    case MOD       : return "%";
    case ADD       : return "+";
    case SUB       : return "-";
    case SHL       : return "<<";
    case SHR       : return ">>";
    case INF       : return "<";
    case INF_EQ    : return "<=";
    case SUP       : return ">";
    case SUP_EQ    : return ">=";
    case EQU       : return "==";
    case NEQ       : return "!=";
    case AND_BIN   : return "&";
    case XOR_BIN   : return "^";
    case OR_BIN    : return "|";
    case AND_LOG   : return "&&";
    case OR_LOG    : return "||";
    case DBL_DOT   : return ":";
    case QUESTION  : return "?";
    case VARIABLE  : return "VARIABLE";
    case COMMA     : return ",";
    case PLACEMAKER: return "PLACEMAKER";
    case BASE      : return "BASE";
    }
    return "?";
}

bool CppPreprocParser::AstData::assemble_barg( Node *o, int need_left, int need_right ) {
    if ( need_right and not o->next )
        return err( o, "Operator " + op_string( o->type ) + " needs a right expression." );
    if ( need_left and ( o->prev == nullptr or o->prev == &base ) )
        return err( o, "Operator " + op_string( o->type ) + " needs a left expression." );
    // prev
    if ( o->prev->parent ) {
        o->parent = o->prev->parent;
        if ( o->prev->parent->children[ 0 ] == o->prev )
            o->prev->parent->children[ 0 ] = o;
        else
            o->prev->parent->children[ 1 ] = o;
    }
    if ( o->prev->prev )
        o->prev->prev->next = o;

    o->children[ 0 ] = o->prev;
    o->children[ 0 ]->parent = o;
    o->prev = o->prev->prev;

    o->children[ 0 ]->next = NULL;
    o->children[ 0 ]->prev = NULL;

    // next
    if ( o->next->next )
        o->next->next->prev = o;

    o->children[ 1 ] = o->next;
    o->children[ 1 ]->parent = o;
    o->next = o->next->next;

    o->children[ 1 ]->prev = NULL;
    o->children[ 1 ]->next = NULL;

    return true;
}

bool CppPreprocParser::AstData::assemble_rarg( AstData::Node *o) {
    if ( not o->next )
        return err( o, "Operator needs a right expression." );
    if ( o->next->next )
        o->next->next->prev = o;

    o->children[ 0 ] = o->next;
    o->children[ 0 ]->parent = o;
    o->next = o->next->next;

    o->children[ 0 ]->prev = NULL;
    o->children[ 0 ]->next = NULL;
    return true;
}

bool CppPreprocParser::AstData::assemble_larg( AstData::Node *o) {
    if ( o->prev == nullptr or o->prev == &base )
        return err( o, "Operator needs a left expression." );
    if ( o->prev->parent ) {
        o->parent = o->prev->parent;
        if ( o->prev->parent->children[ 0 ] == o->prev )
            o->prev->parent->children[ 0 ] = o;
        else
            o->prev->parent->children[ 1 ] = o;
    }
    if ( o->prev->prev )
        o->prev->prev->next = o;

    o->children[ 0 ] = o->prev;
    o->children[ 0 ]->parent = o;
    o->prev = o->prev->prev;

    o->children[ 0 ]->next = NULL;
    o->children[ 0 ]->prev = NULL;
    return true;
}

bool CppPreprocParser::AstData::make_hierarchy() {
    // ()
    std::stack<Node *> opened;
    Node *last_par = nullptr;
    for( Node *n = base.next; n; ) {
        if ( n->type == LFT_PAR ) { // (
            n->prev_grp = last_par;
            last_par = n;

            if ( not n->next )
                return false;
            if ( n->next->type == RGT_PAR ) // nothing ? Weird
                return false;
            opened.push( n );

            // n -> inst -> inst->next => n
            //                            |> inst -
            Node *inst = n->next;
            n->next = 0;
            inst->prev = 0;
            n->children[ 0 ] = inst;
            inst->parent = n;

            n = inst;
        } else if ( n->type == RGT_PAR ) {
            if ( opened.empty() )
                return err( n, "')' has no correspondance" );
            // o
            // |> a -> b -> n -> f
            Node *o = opened.top();
            opened.pop();

            Node *f = n->next;
            n->prev->next = 0;
            o->next = f;
            if ( f )
                f->prev = o;
            n = f;
        } else
            n = n->next;
    }

    //    // function call
    //    for( Node *n = last_par; n; n = n->prev_grp ) {
    //        if ( n->prev and ( n->prev->type == VARIABLE or n->prev->type == DEFINED ) ) {
    //            n->children[ 1 ] = n->children[ 0 ];
    //            assemble_larg( n );
    //            n->type = CALL;
    //        }
    //    }

    //    // unary + or - (here we have a simplified case: no operator with only left arg)
    //    for( Node *o = by_grp[ GRP_ADD ]; o; o = o->prev_grp ) {
    //        if ( o->type == SUB or o->type == ADD ) {
    //            if ( o->prev == nullptr or o->prev == &base or o->prev->type != VARIABLE ) {
    //                o->type = ( o->type == SUB ? SUB_UNA : ADD_UNA );
    //                if ( not assemble_rarg( o ) )
    //                    return false;
    //            }
    //        }
    //    }

    // operators
    for( int num_grp = 1; num_grp < nb_grp; ++num_grp ) {
        for( Node *o = by_grp[ num_grp ]; o; o = o->prev_grp ) {
            switch( behavior( num_grp ) ) {
            case need_none: break;
            case need_larg: if ( not assemble_larg( o ) ) return false; break;
            case need_rarg: if ( not assemble_rarg( o ) ) return false; break;
            case need_barg: if ( not assemble_barg( o, true, true ) ) return false; break;
            }
        }
    }

    // no problem so far
    return true;
}

CppPreprocParser::ST CppPreprocParser::AstData::eval() const {
    return base.next ? base.next->eval() : 0;
}

CppPreprocParser::ST CppPreprocParser::AstData::Node::eval() const {
    switch ( type ) {
    case NUMBER:   return val;
    case VARIABLE:
        // std::cerr << "Var '" << str << "' not sustituted" << std::endl;
        return 0;
    case LFT_PAR:  return   children[ 0 ]->eval();
    case ADD_UNA:  return + children[ 0 ]->eval();
    case SUB_UNA:  return - children[ 0 ]->eval();
    case NOT_LOG:  return ! children[ 0 ]->eval();
    case NOT_BIN:  return ~ children[ 0 ]->eval();
    case MUL:      return children[ 0 ]->eval() *  children[ 1 ]->eval();
    case DIV:      return children[ 0 ]->eval() /  children[ 1 ]->eval();
    case MOD:      return children[ 0 ]->eval() %  children[ 1 ]->eval();
    case ADD:      return children[ 0 ]->eval() +  children[ 1 ]->eval();
    case SUB:      return children[ 0 ]->eval() -  children[ 1 ]->eval();
    case SHL:      return children[ 0 ]->eval() << children[ 1 ]->eval();
    case SHR:      return children[ 0 ]->eval() >> children[ 1 ]->eval();
    case INF:      return children[ 0 ]->eval() <  children[ 1 ]->eval();
    case INF_EQ:   return children[ 0 ]->eval() <= children[ 1 ]->eval();
    case SUP:      return children[ 0 ]->eval() >  children[ 1 ]->eval();
    case SUP_EQ:   return children[ 0 ]->eval() >= children[ 1 ]->eval();
    case EQU:      return children[ 0 ]->eval() == children[ 1 ]->eval();
    case NEQ:      return children[ 0 ]->eval() != children[ 1 ]->eval();
    case AND_BIN:  return children[ 0 ]->eval() &  children[ 1 ]->eval();
    case XOR_BIN:  return children[ 0 ]->eval() ^  children[ 1 ]->eval();
    case OR_BIN:   return children[ 0 ]->eval() |  children[ 1 ]->eval();
    case AND_LOG:  return children[ 0 ]->eval() && children[ 1 ]->eval();
    case OR_LOG:   return children[ 0 ]->eval() || children[ 1 ]->eval();
    // case DBL_DOT:  NSMAKE_TODO; return 327;
    case QUESTION: return children[ 0 ]->eval() ? children[ 1 ]->children[ 0 ]->eval() : children[ 1 ]->children[ 1 ]->eval(); return 327;
    // case BASE    : NSMAKE_TODO; return 327;
    }
    return 0;
}

void CppPreprocParser::AstData::Node::write_to_stream( std::ostream &os, int par_grp ) const {
    if ( type == LFT_PAR )
        return children[ 0 ]->write_to_stream( os, par_grp );

    if ( children[ 0 ] ) {
        if ( grp > par_grp )
            os << "(";
        if ( children[ 1 ] )
            children[ 0 ]->write_to_stream( os, grp );
    }

    switch ( type ) {
    case NUMBER:   os << val;  break;
    case VARIABLE: os << str;  break;
    case RGT_PAR:  os << ")";  break;
    case ADD_UNA:  os << "+";  break;
    case SUB_UNA:  os << "-";  break;
    case NOT_LOG:  os << "!";  break;
    case NOT_BIN:  os << "~";  break;
    case MUL:      os << "*";  break;
    case DIV:      os << "/";  break;
    case MOD:      os << "%";  break;
    case ADD:      os << "+";  break;
    case SUB:      os << "-";  break;
    case SHL:      os << "<<"; break;
    case SHR:      os << ">>"; break;
    case INF:      os << "<";  break;
    case INF_EQ:   os << "<="; break;
    case SUP:      os << ">";  break;
    case SUP_EQ:   os << ">="; break;
    case EQU:      os << "=="; break;
    case NEQ:      os << "!="; break;
    case AND_BIN:  os << "&";  break;
    case XOR_BIN:  os << "^";  break;
    case OR_BIN:   os << "|";  break;
    case AND_LOG:  os << "&&"; break;
    case OR_LOG:   os << "||";  break;
    case DBL_DOT:  os << ":";  break;
    case QUESTION: os << "?";  break;
    case COMMA   : os << ",";  break;
    case BASE    : os << "BASE";  break;
    }

    if ( children[ 0 ] ) {
        if ( children[ 1 ] )
            children[ 1 ]->write_to_stream( os, grp );
        else
            children[ 0 ]->write_to_stream( os, grp );
        if ( grp > par_grp )
            os << ")";
    }

    if ( next )
        next->write_to_stream( os ); // << " "
}

CppPreprocParser::AstData::Node *CppPreprocParser::AstData::Node::get_last() {
    return next ? next->get_last() : this;
}

CppPreprocParser::AstData::Node *CppPreprocParser::AstData::Node::copy() {
    std::string cstr = str;
    return new Node( type, val, std::move( cstr ) );
}
