#!/usr/bin/env bash
# Rizz Studio portable toolchain installer.
#
# Installs, without root:
#   ~/.dotnet                                  .NET SDK 8 (builds net472 projects)
#   ~/.local/share/bikinstudio/mono            Mono 6.12 + WinForms runtime
#
# Usage: scripts/install-toolchain.sh
# Env:   BIKINSTUDIO_TOOLCHAIN   override the toolchain directory
#        BIKINSTUDIO_DOTNET_DIR  override the .NET install directory
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOME="${HOME:-$USER}"
TOOLCHAIN="${BIKINSTUDIO_TOOLCHAIN:-$HOME/.local/share/bikinstudio}"
DOTNET_DIR="${BIKINSTUDIO_DOTNET_DIR:-$HOME/.dotnet}"
MONO_PREFIX="$TOOLCHAIN/mono"
CACHE="$TOOLCHAIN/cache"
UBUNTU="http://archive.ubuntu.com/ubuntu"
MONO_POOL="$UBUNTU/pool/universe/m/mono"

say()  { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

command -v curl >/dev/null || die "curl is required"
command -v tar  >/dev/null || die "tar is required"
command -v ar   >/dev/null || die "ar (binutils) is required"

mkdir -p "$TOOLCHAIN" "$CACHE"

# ---------------------------------------------------------------------------
# 1. .NET SDK
# ---------------------------------------------------------------------------
if [ -x "$DOTNET_DIR/dotnet" ] && "$DOTNET_DIR/dotnet" --version >/dev/null 2>&1; then
  say ".NET SDK already present: $("$DOTNET_DIR/dotnet" --version)"
else
  say "Installing .NET SDK 8 into $DOTNET_DIR"
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o "$CACHE/dotnet-install.sh"
  bash "$CACHE/dotnet-install.sh" --channel 8.0 --install-dir "$DOTNET_DIR" --no-path
  "$DOTNET_DIR/dotnet" --version >/dev/null || die ".NET SDK install failed"
  info ".NET $("$DOTNET_DIR/dotnet" --version) ready"
fi

# ---------------------------------------------------------------------------
# 2. Mono runtime
# ---------------------------------------------------------------------------
if [ -x "$MONO_PREFIX/usr/bin/mono" ] && \
   LD_LIBRARY_PATH="$MONO_PREFIX/usr/lib:$MONO_PREFIX/usr/lib/x86_64-linux-gnu" \
   "$MONO_PREFIX/usr/bin/mono" --version >/dev/null 2>&1; then
  say "Mono runtime already present: $(
    LD_LIBRARY_PATH="$MONO_PREFIX/usr/lib:$MONO_PREFIX/usr/lib/x86_64-linux-gnu" \
    "$MONO_PREFIX/usr/bin/mono" --version 2>/dev/null | head -1)"
else
  say "Installing Mono 6.12 into $MONO_PREFIX"
  mkdir -p "$MONO_PREFIX"

MONO_DEBS="
ca-certificates-mono_6.12.0.199+dfsg-6_all.deb
libmono-2.0-1_6.12.0.199+dfsg-6_amd64.deb
libmono-2.0-dev_6.12.0.199+dfsg-6_amd64.deb
libmono-accessibility4.0-cil_6.12.0.199+dfsg-6_all.deb
libmonoboehm-2.0-1_6.12.0.199+dfsg-6_amd64.deb
libmonoboehm-2.0-1-dbg_6.12.0.199+dfsg-6_amd64.deb
libmonoboehm-2.0-dev_6.12.0.199+dfsg-6_amd64.deb
libmono-btls-interface4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-cairo4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-cecil-private-cil_6.12.0.199+dfsg-6_all.deb
libmono-cil-dev_6.12.0.199+dfsg-6_all.deb
libmono-codecontracts4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-compilerservices-symbolwriter4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-corlib4.5-cil_6.12.0.199+dfsg-6_all.deb
libmono-corlib4.5-dll_6.12.0.199+dfsg-6_all.deb
libmono-cscompmgd0.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-csharp4.0c-cil_6.12.0.199+dfsg-6_all.deb
libmono-custommarshalers4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-data-tds4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-db2-1.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-debugger-soft4.0a-cil_6.12.0.199+dfsg-6_all.deb
libmono-http4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-i18n4.0-all_6.12.0.199+dfsg-6_all.deb
libmono-i18n4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-i18n-cjk4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-i18n-mideast4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-i18n-other4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-i18n-rare4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-i18n-west4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-ldap4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-management4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-messaging4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-messaging-rabbitmq4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-microsoft-build4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-microsoft-build-engine4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-microsoft-build-framework4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-microsoft-build-tasks-v4.0-4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-microsoft-build-utilities-v4.0-4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-microsoft-csharp4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-microsoft-visualc10.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-microsoft-web-infrastructure1.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-oracle4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-parallel4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-peapi4.0a-cil_6.12.0.199+dfsg-6_all.deb
libmono-posix4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-profiler_6.12.0.199+dfsg-6_amd64.deb
libmono-rabbitmq4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-relaxng4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-security4.0-cil_6.12.0.199+dfsg-6_all.deb
libmonosgen-2.0-1_6.12.0.199+dfsg-6_amd64.deb
libmonosgen-2.0-1-dbg_6.12.0.199+dfsg-6_amd64.deb
libmonosgen-2.0-dev_6.12.0.199+dfsg-6_amd64.deb
libmono-sharpzip4.84-cil_6.12.0.199+dfsg-6_all.deb
libmono-simd4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-smdiagnostics0.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-sqlite4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-componentmodel-composition4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-componentmodel-dataannotations4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-configuration4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-configuration-install4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-core4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-data4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-data-datasetextensions4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-data-entity4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-data-linq4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-data-services4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-data-services-client4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-deployment4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-design4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-drawing4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-drawing-design4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-dynamic4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-enterpriseservices4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-identitymodel4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-identitymodel-selectors4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-io-compression4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-io-compression-filesystem4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-json4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-json-microsoft4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-ldap4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-ldap-protocols4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-management4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-messaging4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-net4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-net-http4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-net-http-formatting4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-net-http-webrequest4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-numerics4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-numerics-vectors4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-reactive-core2.2-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-reactive-debugger2.2-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-reactive-experimental2.2-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-reactive-interfaces2.2-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-reactive-linq2.2-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-reactive-observable-aliases0.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-reactive-platformservices2.2-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-reactive-providers2.2-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-reactive-runtime-remoting2.2-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-reactive-windows-forms2.2-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-reactive-windows-threading2.2-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-reflection-context4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-runtime4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-runtime-caching4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-runtime-durableinstancing4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-runtime-serialization4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-runtime-serialization-formatters-soap4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-security4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-servicemodel4.0a-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-servicemodel-activation4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-servicemodel-discovery4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-servicemodel-internals0.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-servicemodel-routing4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-servicemodel-web4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-serviceprocess4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-threading-tasks-dataflow4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-transactions4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-abstractions4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-applicationservices4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-dynamicdata4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-extensions4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-extensions-design4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-http4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-http-selfhost4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-http-webhost4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-mobile4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-mvc3.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-razor2.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-regularexpressions4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-routing4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-services4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-webpages2.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-webpages-deployment2.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-web-webpages-razor2.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-windows4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-windows-forms4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-windows-forms-datavisualization4.0a-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-workflow-activities4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-workflow-componentmodel4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-workflow-runtime4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-xaml4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-xml4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-xml-linq4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-system-xml-serialization4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-tasklets4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-webbrowser4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-webmatrix-data4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-windowsbase4.0-cil_6.12.0.199+dfsg-6_all.deb
libmono-xbuild-tasks4.0-cil_6.12.0.199+dfsg-6_all.deb
mono-4.0-gac_6.12.0.199+dfsg-6_all.deb
mono-4.0-service_6.12.0.199+dfsg-6_all.deb
mono-complete_6.12.0.199+dfsg-6_amd64.deb
mono-csharp-shell_6.12.0.199+dfsg-6_all.deb
mono-dbg_6.12.0.199+dfsg-6_all.deb
mono-devel_6.12.0.199+dfsg-6_all.deb
monodoc-base_6.12.0.199+dfsg-6_all.deb
monodoc-manual_6.12.0.199+dfsg-6_all.deb
mono-gac_6.12.0.199+dfsg-6_all.deb
mono-mcs_6.12.0.199+dfsg-6_all.deb
mono-runtime_6.12.0.199+dfsg-6_amd64.deb
mono-runtime-boehm_6.12.0.199+dfsg-6_amd64.deb
mono-runtime-common_6.12.0.199+dfsg-6_amd64.deb
mono-runtime-dbg_6.12.0.199+dfsg-6_amd64.deb
mono-runtime-sgen_6.12.0.199+dfsg-6_amd64.deb
mono-utils_6.12.0.199+dfsg-6_amd64.deb
mono-xbuild_6.12.0.199+dfsg-6_all.deb
libmono-microsoft-visualbasic10.0-cil_4.0.1-3_all.deb
"

  fetch_deb() {
    local url="$1" dest="$2"
    if [ ! -s "$dest" ]; then
      info "download $(basename "$dest")"
      curl -fsSL --retry 3 "$url" -o "$dest" || return 1
    fi
  }

  extract_deb() {
    local deb="$1" tmp="$CACHE/extract"
    rm -rf "$tmp"; mkdir -p "$tmp"
    local member
    member="$(ar t "$deb" | grep '^data\.tar' | head -1)"
    [ -n "$member" ] || { info "no data member in $(basename "$deb")"; return 1; }
    case "$member" in
      *.zst) ar p "$deb" "$member" | tar --zstd -xf - -C "$MONO_PREFIX" --no-same-owner --no-same-permissions ;;
      *.xz)  ar p "$deb" "$member" | tar -xJf - -C "$MONO_PREFIX" --no-same-owner --no-same-permissions ;;
      *.gz)  ar p "$deb" "$member" | tar -xzf - -C "$MONO_PREFIX" --no-same-owner --no-same-permissions ;;
      *.bz2) ar p "$deb" "$member" | tar -xjf - -C "$MONO_PREFIX" --no-same-owner --no-same-permissions ;;
      *)     ar p "$deb" "$member" | tar -xf - -C "$MONO_PREFIX" --no-same-owner --no-same-permissions ;;
    esac
  }

  for f in $MONO_DEBS; do
    case "$f" in
      libmono-microsoft-visualbasic10.0-cil_*) url="$UBUNTU/pool/universe/m/mono-basic/$f" ;;
      *)                                       url="$MONO_POOL/$f" ;;
    esac
    deb="$CACHE/$f"
    if ! fetch_deb "$url" "$deb"; then
      info "WARNING: could not download $f (continuing)"
      continue
    fi
    extract_deb "$deb" || info "WARNING: could not extract $f (continuing)"
  done

  # Native GDI+ (WinForms drawing). Prefer the system copy when present.
  if ! ls /usr/lib/x86_64-linux-gnu/libgdiplus.so* /usr/lib/libgdiplus.so* >/dev/null 2>&1; then
    f="libgdiplus_6.1+dfsg-2_amd64.deb"
    if fetch_deb "http://deb.debian.org/debian/pool/main/libg/libgdiplus/$f" "$CACHE/$f"; then
      extract_deb "$CACHE/$f" || info "WARNING: could not extract $f"
    else
      info "WARNING: could not download $f (WinForms drawing may not work)"
    fi
  else
    info "libgdiplus already available on the system"
  fi

  # Cairo is normally present on every desktop Linux; bundle a copy if not.
  if ! ls /usr/lib/x86_64-linux-gnu/libcairo.so* /usr/lib/libcairo.so* >/dev/null 2>&1; then
    f="libcairo2_1.18.4-3_amd64.deb"
    if fetch_deb "$UBUNTU/pool/main/c/cairo/$f" "$CACHE/$f"; then
      extract_deb "$CACHE/$f" || info "WARNING: could not extract $f"
    else
      info "WARNING: could not download $f (continuing)"
    fi
  else
    info "libcairo already available on the system"
  fi

  # Mono 6.12 normally ships Microsoft.VisualBasic; verify and fall back to
  # mono-basic's implementation if the CIL assembly is missing.
  if [ ! -f "$MONO_PREFIX/usr/lib/mono/4.5/Microsoft.VisualBasic.dll" ]; then
    f="libmono-microsoft-visualbasic10.0-cil_4.0.1-3_all.deb"
    if fetch_deb "$UBUNTU/pool/universe/m/mono-basic/$f" "$CACHE/$f"; then
      extract_deb "$CACHE/$f" || true
    fi
  fi

  chmod +x "$MONO_PREFIX/usr/bin/"* 2>/dev/null || true

  if ! LD_LIBRARY_PATH="$MONO_PREFIX/usr/lib:$MONO_PREFIX/usr/lib/x86_64-linux-gnu" \
       "$MONO_PREFIX/usr/bin/mono" --version >/dev/null 2>&1; then
    die "Mono was extracted but does not start. Check the output above."
  fi
  say "Mono ready: $(
    LD_LIBRARY_PATH="$MONO_PREFIX/usr/lib:$MONO_PREFIX/usr/lib/x86_64-linux-gnu" \
    "$MONO_PREFIX/usr/bin/mono" --version 2>/dev/null | head -1)"
fi

# ---------------------------------------------------------------------------
# 3. NuGet reference assemblies cache (offline-friendly first build)
# ---------------------------------------------------------------------------
NUGET_CACHE="${NUGET_PACKAGES:-$HOME/.nuget/packages}"
if [ ! -d "$NUGET_CACHE/microsoft.netframework.referenceassemblies/1.0.3" ]; then
  say "Pre-downloading Microsoft.NETFramework.ReferenceAssemblies"
  TMP_PROJ="$CACHE/refpkg"
  mkdir -p "$TMP_PROJ"
  cat > "$TMP_PROJ/refpkg.vbproj" <<'EOF'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net472</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NETFramework.ReferenceAssemblies" Version="1.0.3" PrivateAssets="all" />
  </ItemGroup>
</Project>
EOF
  DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 \
    "$DOTNET_DIR/dotnet" restore "$TMP_PROJ/refpkg.vbproj" >/dev/null 2>&1 || \
    info "WARNING: could not pre-download reference assemblies (the first build will download them)"
fi

say "Toolchain installed"
info ".NET SDK : $DOTNET_DIR/dotnet"
info "Mono     : $MONO_PREFIX/usr/bin/mono"
info "Open Rizz Studio and press F5 to build and run."
