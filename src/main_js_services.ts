import GenericMicroService from "./GenericMicroService"

// register task names
let gms = new GenericMicroService;

gms.add_module( "MainJsFromPackageJson", require( "./MainJsFromPackageJson"  ).default );
gms.add_module( "CoffeescriptCompiler" , require( "./CoffeescriptCompiler"   ).default );
gms.add_module( "TypescriptCompiler"   , require( "./TypescriptCompiler"     ).default );
gms.add_module( "ConcatYamlToJson"     , require( "./ConcatYamlToJson"       ).default );
gms.add_module( "BaseCompilerInfo"     , require( "./BaseCompilerInfo"       ).default );
gms.add_module( "SassCompiler"         , require( "./SassCompiler"           ).default );
gms.add_module( "MissionOutput"        , require( "./MissionOutput"          ).default );
gms.add_module( "MissionMaker"         , require( "./MissionMaker"           ).default );
gms.add_module( "JsDepFactory"         , require( "./JsDepFactory"           ).default );
gms.add_module( "CheckPrerequ"         , require( "./CheckPrerequ"           ).default );
gms.add_module( "CppCompiler"          , require( "./CppCompiler"            ).default );
gms.add_module( "Degradator"           , require( "./Degradator"             ).default );
gms.add_module( "CssParser"            , require( "./CssParser"              ).default );
gms.add_module( "MakeFile"             , require( "./MakeFile"               ).default );
gms.add_module( "JsParser"             , require( "./JsParser"               ).default );
gms.add_module( "Executor"             , require( "./Executor"               ).default );
gms.add_module( "Codegen"              , require( "./Codegen"                ).default );
gms.add_module( "Linker"               , require( "./Linker"                 ).default );
gms.add_module( "Mocha"                , require( "./Mocha"                  ).default );
gms.add_module( "Gtest"                , require( "./Gtest"                  ).default );
gms.add_module( "Sleep"                , require( "./Sleep"                  ).default );

gms.run();
