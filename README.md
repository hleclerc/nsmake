# What is Nsmake ?

Nsmake stands for "No Script Make". It is an extensible build system, designed for **speed**, **correctness** and **orthogonality**, for all kinds of stuff that has to be built.

Whereas most build tools make us write a lot of trivial information, often redundant and scattered, Nsmake takes responsibility to **ensure the link between the tools**, greatly reducing the need to write obvious content, reducing the need for boilerplates, enabling correctness even with complex code generation schemes or side modifications, ...

# Main features

## Orthogonal, clean and clear configuration

* Extensive analyses of tree and content for all the source languages. **Nsmake will never ask you to specify information that can be found directly or indirectly from the sources**.
* No global intricate configuration(s) file(s). **Information is specified where it is relevant**, avoiding doubloons and potential discrepancies.
* No Domain Specific Language: most of the source languages already have conditionals, preprocessors, ... Nsmake let's you be coherent, **avoiding the need for new conventions and new tools** to do something that was already possible without that.
* Significant **reduction of need for boilerplates and tool specific configuration files**: Nsmake fills the gap, allowing cleansing, and cooperation for tools that share information (e.g. compilers, testing tools, installers...).
* Respect of the source tree: Nsmake tries as much as possible to **generate files in build directories, with proper and secure naming**, leaving your in full control of your directories.

## Speed

* The task runner works as a **server**, dramatically reducing start-up time (and enabling consistency between parallel builds).
* Deep and dynamic parallelism: tasks run in micro-services that can interact with the task runner to instantiate **parallel or sequential subtasks**.
* Deep in memory and database caching: all the result of the idempotent tasks are **condensed and cached**, from the parsing results to the dependency analyses.

## General features

* Deep dependency analyses for dramatically **improved correctness**: tests on files that does *not* exist, on configuration information, on external tools, ...
* **Watch mode** for all the kinds of targets.
* **Handling of dependencies and prerequisites**: need and presence of modules, libraries and tools are tested, enabling handling of downloads and installations.
* **Handling of flags and specifications** for libraries (e.g. to use a CDN instead of a local copy, for the specification of the include paths, the library flags, ...) using extensible rule sets and extensive code analyses.

## Specific features

### Javascript and friends

* Concatenation, minification, Typescript, Coffeescript, React extensions, ... with of course plugins and support for arbitrary transformations (e.g. with babel plugins and presets, ...).
* Full support for **Hot Module Reload**.
* Rules for **Nodejs *and* Web** targets (where policies for concatenation, CDN, etc... are not the same),
* **Generation of the surrounding of `.js`-like entry points**: from the complete needed `.html` files (handling of script inclusion, templates, ...), to the sourcemaps.
* Integrated support for **testing frameworks** (mocha, karma, ...),
* **Integrated preprocessing** support (e.g. for handling of target execution, language environment, ...)

### For native executables (C++/...)

* Fully compliant C/C++ preprocessor (proper variable substitution, extensions like `#include_next`, `##__VA_ARGS__`, ...)
* Rules for **inline preprocessing** code generation (launching of tasks for code inclusion and modification).
* Automatic handling of **flags and downloads** for external libraries (`#include <libxml/tree.h>` probably that `libxml` is needed).
* Integrated support for **testing frameworks** (gtest, ...),

# Some tutorials

* [Compilation of a generic web application](https://github.com/hleclerc/nsmake/wiki/Tutorial:-compilation-of-a-generic-web-application)
* [Compilation of a C++ executable](https://github.com/hleclerc/nsmake/wiki/Tutorial:-compilation-of-a-C---executable)

# More specific information

* [Testing a web/nodejs application (using Mocha/Karma/...)](https://github.com/hleclerc/nsmake/wiki/Testing-your-code-with-Mocha,-Karma,-Chai...)
* [Testing a C++ application](https://github.com/hleclerc/nsmake/wiki/Tutorial:-compilation-of-a-CPP-executable)

<!-- It replaces tools like [webpack](https://webpack.github.io/docs/), [cmake](https://cmake.org/), [grunt](http://gruntjs.com/getting-started), [scons](http://scons.org/), [gulp](http://gulpjs.com/), [brunch](http://brunch.io/)... -->

<!--
Most of the build systems need the developers to **re**-declare their stuff in scripts, ending with doubloons, scattering and possible discrepancies with the information. For example, typing `#include <foo.h>` in C++ surely means that
- if there is a `foo.cpp`, we will need the associated symbols (unless, well, there is clutter in the directories :) ), and so on recursively. It is unfortunate to have to add it manually in the build specifications...
- if `foo.h` cannot be found, it may have to be downloaded. If the build system is able to find it by itself (because it has to parse the files) and able to launch the download commands, it is sad for the developers to have to maintain manually a list of dependencies, and ask the user to manually launch a dependency update command before the compilation ones...
- with the same idea, if `foo.h` is known to be associated with a library (`libbar.so` for instance), it is regrettable for the developers to have to specify `-lbar -Lpath` manually in another place(s)...
- if there is a `foo.h.in.py` (or whatever convention you like for code generation), it is clear that we may need to generate `foo.h` and well... code generation has always been the Cinderella of build systems (more on this below).
- etc, etc (this list can actually become very long)...

NSMake try to solve these issues by avoiding the scattering of information, and using automation as much as possible. The result is that most of the projects do not need any script for the build specifications, hence the name (abbreviation of "No Script Make").

Moreover, NSMake is friendly with **code generation**, notably by enabling interruptible parsing/execution (e.g. if a file to be generated is needed during parsing) and *dynamic* dependencies (targets may for instance welcome additional children, added during execution).

Of course, NSMake is designed to execute fast (proper caching, "deep" parallelism, fast parsers, etc...). Large projects are welcome.

NSMake is not focused on a particular language but included rules are currently mainly for the JS and C++ worlds. Nevertheless, all requests for new language support are welcome :)

# C/C++ Illustration

This section focuses on the C++ language. If you care more about JS or other languages, feel free to skip it.
Let us consider the following example:

```cpp
// foo.cpp
#include "bar.h"
int main() {
    fun();
}
```

```cpp
// bar.h
#pragma once
void fun();
```

```cpp
// bar.cpp
void fun() {}
```

If in the command line, we type

```bash
nsmake foo.cpp
```

It will execute something like:

```bash
g++ -c -o nsmake/build/bar_GHACFECCGGFDGGHA.o bar.cpp
g++ -c -o nsmake/build/foo_AAAEDGEGFHEHBBAA.o foo.cpp
g++ -o nsmake/build/CECEGFEDFEGCEGCF.exe nsmake/build/foo_AAAEDGEGFHEHBBAA.o nsmake/build/bar_GHACFECCGGFDGGHA.o
nsmake/build/CECEGFEDFEGCEGCF.exe
```

`nsmake` works by "missions" and the default mission for a `.cpp` file is to make an executable (with the dependencies) and run it (by default, if works the same for javascript, python, etc...). "Missions" can be specified using the `-m` flag (`-m help` for a list of possible missions, for instance `-m clean` to clean the `build` and `cmd` dirs) and cover a variety of tasks (creation of a library, minification, run the tests, ...), that can be extended.

As one can see, the dependencies of `foo.cpp` are automatically added. The letters added for the build names are chosen to avoid collision while enabling cohabitation between several versions (e.g. for different flags like levels of optimization, etc...).

To make an executable without running it, one can type

```bash
nsmake -m exe -o foo foo.cpp # -o means "output name"
```

## Flags

Here is an example of how to insert nsmake commands inside sourcefiles:

```cpp
// foo.cpp
//// nsmake global cpp_flag -O2
...
```

```cpp
// bar.cpp
//// nsmake cxx_name clang++
...
```

And in the command line:

```bash
nsmake --cpp-flag -g3 foo.cpp
```

The preceding files and command will produce something like:

```bash
clang++ -g3 -O2 -c -o nsmake/build/bar_ABADECDBHCDHFHFC.o bar.cpp
g++ -g3 -O2 -c -o nsmake/build/foo_EBABHACEHAFCAFFH.o foo.cpp
g++ -o nsmake/build/EABFDADCGFGHEEED.exe nsmake/build/foo_EBABHACEHAFCAFFH.o nsmake/build/bar_ABADECDBHCDHFHFC.o
nsmake/build/EABFDADCGFGHEEED.exe
```

It illustrate the two possible ways to add flags:
* directly into the sources (eventually with the keyword `global` to spread outside the source)
* or via the command line.

### List of C/C++ nsmake flags

* `cpp_flag`: add a flag for the compiler
* `gpu_flag`: add a flag for the nvcc compiler
* `cxx_name`: name of the compiler
* `inc_path`: add an include path (for nsmake and the chosen compilers)
* `lib_path`: add a library path (for nsmake and the chosen linkers)
* `lib_name`: add a library (same name as with the `-l` gcc/clang/icc/... flag)
* `loca_lib`: add a library handled by nsmake (see [Libraries](#libraries))
* `ld_flag` : add a flag for the linker
* `ld_name` : name of the linker

## Conditions

Here are the main possibilities:
* the preprocessor directives are fully understood by the parsers of `nsmake`. It implies that `#if`, `#else`, `#elif` can be used to activate/disable flags, as in:

```cpp
#if defined( _WIN32 ) || defined( _WIN64 )
//// nsmake cpp_flag some_specific_flag
#else
//// nsmake cpp_flag something_else
#endif
```

* Files containing flags can of course be generated, and can be generated by any language (see [Code generation](#code-generation) for details). For instance, if you like python:

```py
# myflags.h.in.py
import os
if os.name == "nt":
    print( "//// nsmake cpp_flag some_specific_flag" )
else:
    print( "//// nsmake cpp_flag something_else" )
```

* Global flags can also be specified in the command line. If for instance one use a `Makefile` to store the project commands, one can write something like:

```sh
debug:
    nsmake -g3 foo
opt:
    nsmake -O3 foo
```

Some cpp flags are natively understood by nsmake (see the file `src/NSMake/GeneratorCpp`). If not registered, it is possible to use `cpp-flag` or `ld-flag` to send specific flags to the compiler and to the linker. Here is a list of flags that are handled for C/C++:

```
-I [ --include-path ] arg Add the directory arg to the list of directories to
                          be searched for header files
-L [ --library-path ] arg Add the directory arg to the list of directories to
                          be searched for libraries
-D [ --define ] arg       Macro definition
-g [ --debug-level ] arg  Set debug level
-O [ --opt-level ] arg    Set optimization level
--cxx arg                 Set default C++ compiler
--ld arg                  Set default linker
--cpp-flag arg            Add flags to the C++ compiler
--lnk-flag arg            Add flags to the linker
```

## Internal Libraries

```cpp
//// nsmake loca_lib foo.h
```

in a source means that `foo.h` and its dependencies (`.h`, `.cpp`, ...) should be compiled in a separate library.

## External libraries

Each time nsmake finds the need for an external include, it looks if it is possible to automatically add the needed flags.

Nsmake use the `.yaml` files in `${PROJECT}/nsmake/cpp_decl/`, `~/.config/nsmake/cpp_decl/` and `/usr/share/nsmake/cpp_decl/`. They define flags and download instruction (used of course only if the headers are not found).

For instance, if one of these directory contain a file like:

```yaml
includes: [ libxml/tree.h libxml/parser.h ]
flag_sets:
  - systems:   [] # the same flag set can be used for all the systems. Typical value: win32
    inc_paths: [ ext/libxml2/include/libxml2, /usr/include/libxml2 ]
    lib_paths: [ ext/libxml2/lib ]
    lib_names: [ xml2 ] # flag names correspond to nsmake commands (e.g. ld_flags, ...)
load_sets:
  - systems: [ Ubuntu, Debian ]
    command: apt-get install libxml2-dev
    root:    true # this variant will be used only if --no-root has not been specified in the command line
  - systems: [] # if none of the previous variants worked
    command: "wget ftp://xmlsoft.org/libxml2/libxml2-2.9.4.tar.gz &&
              tar xzf libxml2-2.9.4.tar.gz && cd libxml2-2.9.4 &&
              ./configure --without-python --prefix=`pwd`/ext/libxml2 &&
              make install"
```

a cpp file like

```cpp
#include <libxml/tree.h>
```

will download/compile the library if libxml/tree.h cannot be found in the include paths (including of course the ones specified in the yaml file), and will register the flags for the compilation and link commands.

Currently, nsmake does not provide default `cpp_decl` files but it is planned for a near future (maybe with a server able to find which one to download, etc...).

# Code generation

Nsmake can handle code generation either
- with files to be interpreted/compiled/executed (`.gen.xyz`)
- or with inline commands, inside the code (`NSMAKE_CMD`)

## .gen.$ext.$lang

A first approach for code generation consists in naming the needed files with `.gen.$ext.$lang` at the end, where `ext` is the wanted final extension(s) (`.cpp`, `.h`, ...) and `$lang` describes the language of the generator.

For instance, with
```python
# main.gen.cpp.py
import sys
open( sys.argv[ 1 ], "w" ).write( "int main() { return 0; }" )
```

the command
```bash
nsmake main.gen.cpp
```

will execute the following lines
```bash
python main.gen.cpp.py main.gen.cpp
g++ -c -o nsmake/build/main.gen_GGCAFEHEGBCHFCGA.o main.gen.cpp
g++ -o nsmake/build/DGCEBCHAECDEBADA.exe nsmake/build/main.gen_GGCAFEHEGBCHFCGA.o
nsmake/build/DGCEBCHAECDEBADA.exe
```

Of course, it works for all kind of needed files, requested in any way (`#include`, ...).

The convention is to add `.gen.$ext` after the name of the file that has to be generated, where `.$ext` is the usual extension for the chosen language. The generator has to start with the same name, plus the usual extension to define the used language. It can be for instance a `.gen.$ext.cpp` (will parse, compile, link and execute using nsmake), a `.gen.$ext.py` (will call the `python`), a `.gen.$ext.js` (will use `nodejs`), a `.gen.$ext.sh` (will use bash), an so on...

Optionally, the user can send arguments to the script, using the question mark, plus arguments. For instance, if we have

```cpp
#include "foo.gen.h?arg1%20arg2"
// ...
```

and we assume that we have a `foo.gen.h.$lang` file, it will be executed with `foo.gen.h arg1 arg2` as arguments (enabling reuse of the same script for different targets).

Nsmake tests all the needed files to see if they result from code generation. For instance, when it parses a `.cpp` file and finds that this one needs a `foo.h`, it looks if there's a `foo.h.in.py`, a `foo.h.in.cpp`, and so on.... `foo.h.in.xyz` will of course has the priority other a potentially existing `foo.h`. This works of course with all the kinds of files (`.cpp`, ...), included or not.

For code generation, Nsmake solves the following challenges:
* content of generated file can not be considered as prior information. It notably means that the dependencies must be dynamic (cannot be fully known after a first pass) and that content parsing can be interrupted (e.g. if a file needs the content of a generated header, one must interrupt the parsing to generate the file(s) and then it can be resumed).
* nsmake takes care of external modifications. For instance, if a human modifies a generated file (well this is quite frequent notably if after an error a compiler points to generated stuff), nsmake will never overwrite it (unless if use of the `-f` flag), stopping the build if the file is a dependency.


## NSMAKE_CMD / NSMAKE_RUN (inline code generation)

It is possible to include generated code without having to create separated files.

## NSMAKE_CMD

`NSMAKE_CMD( PROG, LANG, ... )` allows for arbitrary compile time substitutions. It takes as parameters the content of a program to generate the code, and optionally, an extension (`.cpp`, `.py`, `.js`, ...) to specify the language and arguments that will be passed to the executable. The extension is optional: if `PROG` is specified without quote, nsmake assumes that it is in the same language than the surrogate source and do not expect a `LANG` argument. `NSMAKE_CMD` will execute the program with a redirected `stdout`.

For example, with

```cpp
// foo.cpp

#define GOOGLE_COORDS( LOCATION ) NSMAKE_CMD( \
    "import json, sys, urllib.parse, urllib.request\n" \
    "url = 'http://maps.google.com/maps/api/geocode/json?address=' + urllib.parse.quote( '" LOCATION "' ) + '&sensor=false'\n" \
    "ans = json.loads( urllib.request.urlopen( url ).read().decode( 'UTF-8' ) )\n" \
    "crd = ans['results'][ 0 ]['geometry']['location']\n" \
    "print( '{ ' + str( crd['lng'] ) + ', ' + str( crd['lat'] ) + ' }' )\n", \
    ".py" \
)

double coords[] = GOOGLE_COORDS( "Paris, France" );
```

nsmake will output a copy of `foo.cpp` in the build dir, with `GOOGLE_COORDS( "Paris, France" )` substituted by `{ 2.3522219, 48.856614 }`.

Of course, nsmake will run the scripts only if necessary, and takes care of the dependencies. For instance, if there is a modification in `urllib/parse.py`, nsmake will consider that the `GOOGLE_COORDS` script will have to be executed again...

## NSMAKE_RUN

`NSMAKE_RUN( FILE, ... )` pursue the same goal than `NSMAKE_CMD` excepted that it takes a file as parameter (that will be compiled/executed by nsmake) + optional additional arguments.

For example:

```cpp
// hexa_corr.cpp
#include <fstream>
#include <vector>
int main( int argc, char * * argv ) {
    std::vector<int> v( 256, atoi( argv[ 2 ] ) );
    for( int i = 0; i < 10; ++i ) v[ '0' + i ] = i;
    for( int i = 0; i <  6; ++i ) v[ 'a' + i ] = 10 + i;
    for( int i = 0; i <  6; ++i ) v[ 'A' + i ] = 10 + i;
    std::ofstream f( argv[ 1 ] );
    f << "{";
    for( int i = 0; i < v.size(); ++i )
        f << v[ i ] << ",";
    f << "}";
}
```

```cpp
int hexa_corr[] = NSMAKE_RUN( "hexa_corr.cpp", -1 /*default value*/ );
```

Of course, the script can be in any language (`.cpp`, `.coffee`, `.py`, ...), provided that it is supported by nsmake (for the `run` "mission").

# Javascript/Typescript/Coffeescript/...

Nsmake has default rules to:
* make minified versions of a javascript file with its dependencies (automatically found),
* make an `.html` file to load and execute a javascript and its dependency in a browser (with of course the possibility to use templates for the static content),
* transpile from Typescript/Coffeescript/JSX if a regular `.js` file is needed,
* run and test all of this.

* sourcemaps
* watch also html files, everything

Example:

```js
// foo.js
import * from "bar"
```

```js
// bar.ts
function fun() : Void {}
```

tests types for require (+ use of else)):

```js
if ( typeof window  !== "undefined" ) // or typeof( ... )
if ( typeof process !== "undefined" ) // or typeof( ... )
if ( typeof window  === "undefined" ) // or typeof( ... )
if ( typeof process === "undefined" ) // or typeof( ... )
if ( typeof window  !=  "undefined" ) // or typeof( ... )
if ( typeof process !=  "undefined" ) // or typeof( ... )
if ( typeof window  ==  "undefined" ) // or typeof( ... )
if ( typeof process ==  "undefined" ) // or typeof( ... )
```

var process={env:{NODE_ENV:{ process.env.NODE_ENV
"production"

nsmake es_version 5, 6
nsmake need_hmr
nsmake html_content
nsmake html_template

nsmake ht --es-target "targets:{browsers:['last 3 versions']}" ex/pouetox.js


//// nsmake ext_lib react     https://unpkg.com/react@15/dist/react.js         React
//// nsmake ext_lib react-dom https://unpkg.com/react-dom@15/dist/react-dom.js ReactDOM

Proxying react => not in production. Not trivial update => maybe not possible with RHU

Generation:
```js
"./filename!..%2Fgenerator.ts(./operations.ts,.ts)"
// Rec:
"./filename!..%2Fgenerator.ts(./another_name,.ts)"
```

## Download

When a module is needed, by default, it trie do download it using `npm install`

...

# TODO

Feel free to add stuff in this list:

* Plugins: it would be great for extensibility to support plugin definition inside the `nsmake` dir, or inside system directories. It would be a way to define new Generators (to handle mission, and how to make a given target)
* Better clean: currently, clean removes everything in `cmd` and `build` directories. It would be great to to clean all *excepted* what is needed for a set of targets. Also, it would be great to handle *precious* builds, e.g. the ones that takes a lot of time.
-->
