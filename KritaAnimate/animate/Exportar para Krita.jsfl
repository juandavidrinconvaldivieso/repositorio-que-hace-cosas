// Exporta el documento actual para Krita: un PNG por capa y fotograma clave + manifest.json
var doc = fl.getDocumentDOM();
if (!doc) alert("Abre primero un documento.");
else {
	var carpeta = fl.browseForFolderURL("Carpeta donde guardar la exportacion para Krita");
	if (carpeta) exportar(doc, carpeta);
}

function json(v) {
	if (v === null || v === undefined) return "null";
	if (typeof v == "number" || typeof v == "boolean") return String(v);
	if (typeof v == "string") {
		var s = "";
		for (var i = 0; i < v.length; i++) {
			var c = v.charCodeAt(i);
			s += (c < 32 || c > 126 || c == 34 || c == 92) ? "\\u" + ("000" + c.toString(16)).slice(-4) : v.charAt(i);
		}
		return '"' + s + '"';
	}
	var p = [];
	if (v instanceof Array) {
		for (var i = 0; i < v.length; i++) p.push(json(v[i]));
		return "[" + p.join(",") + "]";
	}
	for (var k in v) p.push(json(k) + ":" + json(v[k]));
	return "{" + p.join(",") + "}";
}

function ruta(lay) {
	var r = lay.name;
	for (var p = lay.parentLayer; p; p = p.parentLayer) r = p.name + "/" + r;
	return r;
}

// Un fotograma se "hornea" si tiene interpolacion o un simbolo grafico animado
function animado(fr) {
	if (fr.tweenType != "none") return true;
	for (var i = 0; i < fr.elements.length; i++) {
		var e = fr.elements[i];
		if (e.elementType == "instance" && e.symbolType == "graphic" && e.libraryItem.timeline.frameCount > 1) return true;
	}
	return false;
}

function exportar(doc, carpeta) {
	var tl = doc.getTimeline(), L = tl.layers, tipos = [], salida = [];
	for (var i = 0; i < L.length; i++) tipos.push(L[i].layerType);
	var perfil = doc.exportPublishProfileString();
	var nuevo = perfil.replace(/(<PublishPNGProperties[\s\S]*?<BitDepth>)[^<]*(<\/BitDepth>)/, function (a, x, y) {
		return x + "24-bit with Alpha" + y;
	}).replace(/(<PublishPNGProperties[\s\S]*?<MatchMovieDim>)\d(<\/MatchMovieDim>)/, function (a, x, y) {
		return x + "1" + y;
	});
	doc.importPublishProfileString(nuevo);
	try {
		for (var k = 0; k < L.length; k++) {
			if (tipos[k] != "normal" && tipos[k] != "masked") continue;
			// Las demas capas pasan a guia: las guias nunca se exportan
			for (var j = 0; j < L.length; j++)
				if (j != k && (tipos[j] == "normal" || tipos[j] == "masked")) L[j].layerType = "guide";
			L[k].layerType = tipos[k];
			var fr = L[k].frames, claves = [], fotos = [];
			for (var t = 0; t < fr.length; t++)
				if (fr[t].startFrame == t || animado(fr[t])) claves.push(t);
			for (var c = 0; c < claves.length; c++) {
				var t = claves[c], archivo = null;
				if (fr[t].elements.length) {
					archivo = "capa" + ("00" + k).slice(-3) + "_t" + ("0000" + t).slice(-5) + "_anim.png";
					tl.currentFrame = t;
					doc.exportPNG(carpeta + "/" + archivo, true, true);
				}
				fotos.push({ t: t, dur: (c + 1 < claves.length ? claves[c + 1] : fr.length) - t, file: archivo });
			}
			salida.push({ name: ruta(L[k]), visible: L[k].visible, opacity: 1, frames: fotos });
		}
	} finally {
		for (var i = 0; i < L.length; i++) if (L[i].layerType != tipos[i]) L[i].layerType = tipos[i];
		doc.importPublishProfileString(perfil);
	}
	var m = { origen: "animate", name: doc.name.replace(/\.fla$/i, ""), width: doc.width, height: doc.height,
		fps: doc.frameRate, start: 0, frames: tl.frameCount, layers: salida };
	FLfile.write(carpeta + "/manifest.json", json(m));
	alert("Exportadas " + salida.length + " capas.\nEn Krita: Herramientas > Scripts > Importar desde Adobe Animate");
}
