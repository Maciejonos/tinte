# Maintainer: Maciej <macrionyn@proton.me>

pkgname=tinte
pkgver=1.0.0
pkgrel=1
pkgdesc="Wallpaper utility and theme generator for Wayland"
arch=('any')
url="https://github.com/Maciejonos/tinte"
license=('MIT')
depends=('gjs' 'gtk4' 'libadwaita' 'libsoup3' 'imagemagick' 'matugen')
conflicts=('tinte')
provides=('tinte')

package() {
  cd "$startdir"

  install -dm755 "$pkgdir/usr/share/tinte"
  cp -r src templates "$pkgdir/usr/share/tinte/"

  install -Dm755 tinte "$pkgdir/usr/bin/tinte"

  install -Dm644 org.tinte.Tinte.desktop "$pkgdir/usr/share/applications/org.tinte.Tinte.desktop"

  if [ -f icon.png ]; then
    install -Dm644 icon.png "$pkgdir/usr/share/pixmaps/tinte.png"
  fi

}
