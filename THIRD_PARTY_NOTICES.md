# Third-Party Notices

## Magic UI — NumberTicker adaptation

AXIMACH includes a small adaptation of Magic UI's NumberTicker component in
`src/visuals/NumberTicker.tsx`.

- Upstream project: https://github.com/magicuidesign/magicui
- Source component (pinned revision): https://github.com/magicuidesign/magicui/blob/b0b2e4974b1b68cd5278277c6837a27736e20c3a/apps/www/registry/magicui/number-ticker.tsx
- License: MIT
- Adaptations: removed the upstream Tailwind/class utility dependency, adopted AXIMACH's locale formatting, added reduced-motion handling, and typed the public component props.

### MIT License

Copyright (c) Magic UI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## React Flow — Manufacturing Universe graph canvas

AXIMACH uses the `@xyflow/react` package to render the live Manufacturing Universe relationship graph. The package is used as an upstream dependency; no React Flow source files are copied into AXIMACH.

- Upstream project: https://github.com/xyflow/xyflow
- Package: `@xyflow/react` 13.0.2
- License: MIT
- Usage: interactive pan/zoom canvas, relationship edges, minimap and viewport controls. AXIMACH retains its own manufacturing records, entity model, graph filters, search, source navigation and exports.

### MIT License

Copyright (c) 2019-2025 webkid GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## public-apis — curated API directory reference

AXIMACH curates a small number of API provider entries from the community-maintained
[public-apis/public-apis](https://github.com/public-apis/public-apis) directory in
`server/integrations/public-apis.mjs`. Only provider names, directory descriptions,
source links and a limited set of read-only adapter contracts are used; the upstream
directory is not bundled as an executable dependency.

- Upstream directory: https://github.com/public-apis/public-apis
- Source file: https://github.com/public-apis/public-apis/blob/master/README.md
- Upstream directory licence: MIT
- The MIT licence applies to the public-apis repository's own directory content.
  It does not grant a licence to provider APIs, third-party datasets, trademarks or
  service terms. Each provider has separate access, attribution, quota, privacy and
  commercial-use conditions; see `docs/public-api-adoption.md`.
- AXIMACH uses only three fixed, read-only provider adapters at present. Other entries
  are labelled candidate or review-required and are not called automatically.

### MIT License

Copyright (c) 2022 public-apis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
