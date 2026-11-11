// Importa en Animate una carpeta exportada desde Krita (PNG + manifest.json)
// Se elige el propio manifest.json; los PNG deben estar en su misma carpeta
var archivo = fl.browseForFileURL("open", "Selecciona el manifest.json exportado desde Krita");
if (archivo) {
	var carpeta = archivo.substring(0, archivo.lastIndexOf("/"));
	var txt = FLfile.read(archivo);
	if (!txt) alert("No se pudo leer el archivo.");
	else importar(eval("(" + txt + ")"));
}

function importar(m) {
	var doc = fl.createDocument("timeline");
	doc.width = m.width;
	doc.height = m.height;
	doc.frameRate = m.fps;
	// Umbral de Trazar mapa de bits: mas bajo = mas detalle y mas formas; 0 = no vectorizar
	var umbral = parseInt(prompt("Vectorizar dibujos: umbral de color (1-500, menos = mas detalle; 0 = no vectorizar)", "40"), 10);
	if (isNaN(umbral)) umbral = 0;
	var tl = doc.getTimeline();
	tl.layers[0].name = "__base_krita__";
	var n = 0;
	// El manifest va de arriba abajo; se crean de abajo arriba
	for (var i = m.layers.length - 1; i >= 0; i--) {
		var c = m.layers[i];
		if (!c.frames.length) continue;
		var idx = tl.addNewLayer(c.name, "normal", true);
		tl.currentLayer = idx;
		tl.setSelectedLayers(idx);
		for (var j = 0; j < c.frames.length; j++) {
			var f = c.frames[j], t = f.t - m.start;
			if (t > 0) tl.insertBlankKeyframe(t);
			if (!f.file) continue;
			tl.currentFrame = t;
			doc.selectNone();
			doc.importFile(carpeta + "/" + f.file, false);
			if (doc.selection.length) {
				var el = doc.selection[0], mt = el.matrix;
				mt.tx = 0;
				mt.ty = 0;
				el.matrix = mt;
				if (umbral > 0 && !c.bitmap) doc.traceBitmap(Math.min(umbral, 500), 4, "normal", "normal");
			}
		}
		var ult = c.frames[c.frames.length - 1];
		if (ult.dur > 1) tl.insertFrames(ult.dur - 1, false, ult.t - m.start);
		tl.layers[idx].visible = c.visible;
		n++;
	}
	doc.selectNone();
	tl.deleteLayer(tl.findLayerIndex("__base_krita__")[0]);
	tl.currentFrame = 0;
	alert("Importadas " + n + " capas desde Krita.");
}
