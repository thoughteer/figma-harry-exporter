# Harry Exporter

A Figma plugin that allows you to export the whole document as a structured ZIP archive.

## Installation

To install the plugin locally, download this repo, then go to

    Plugins > Development > Create new plugin

in Figma Desktop, and select the downloaded `manifest.json` file.

## Usage

- Open up this plugin
- Specify a [frame name pattern](#frame-name-pattern)
- Specify an [output path pattern](#output-path-pattern)
- Check desired output formats
- Click `Select` and wait till the list of selected frames appears down below
- Make sure the list is correct
- Click `Export` and wait
- Save the archive

### Frame name pattern

A regular expression used to match the name of the frame and extract fields from it.

Matched groups can be further used to form the output path.

For instance, `^[0-9.]+ - ([A-Z]{2})$` will match frames `1.2.3 - EN` and `4.5 - RU`, and group 1 will contain the language code.

### Output path pattern

A path within the ZIP archive (without extension) with optional group references.

A group can be referenced by its index preceded by the dollar sign `$`.
Group 0 is the full name of the frame.

Fot instance, `artboard/$1/$0.png` in the example above will give you files `artboard/EN/1.2.3 - EN.png` and `artboard/RU/4.5 - RU`.

## Development

Just follow this guide: https://www.figma.com/plugin-docs/setup/.

# License

**Harry Exporter** is released under the MIT license.
