package com.vidhyavibe.magazine

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.Executors

class MainActivity : FlutterActivity() {
    private val channelName = "vidhyavibe/pdf_pages"
    private val executor = Executors.newSingleThreadExecutor()
    private val lock = Any()
    private var pfd: ParcelFileDescriptor? = null
    private var renderer: PdfRenderer? = null
    private var pdfPath: String? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        PDFBoxResourceLoader.init(applicationContext)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                executor.execute {
                    try {
                        when (call.method) {
                            "open" -> {
                                closeInternal()
                                val path = call.argument<String>("path")
                                    ?: throw IllegalArgumentException("path required")
                                pdfPath = path
                                pfd = ParcelFileDescriptor.open(
                                    File(path),
                                    ParcelFileDescriptor.MODE_READ_ONLY,
                                )
                                renderer = PdfRenderer(pfd!!)
                                val count = renderer!!.pageCount
                                runOnUiThread { result.success(count) }
                            }
                            "renderPage" -> {
                                val pdf = renderer
                                    ?: throw IllegalStateException("pdf not open")
                                val pageIndex =
                                    (call.argument<Number>("page") ?: 1).toInt() - 1
                                val maxWidth =
                                    (call.argument<Number>("maxWidth") ?: 1080).toInt()
                                        .coerceAtLeast(320)
                                val page = pdf.openPage(pageIndex)
                                try {
                                    val scale =
                                        maxWidth.toFloat() / page.width.coerceAtLeast(1)
                                    val w = maxWidth
                                    val h = (page.height * scale).toInt().coerceAtLeast(1)
                                    val bitmap =
                                        Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                                    bitmap.eraseColor(Color.WHITE)
                                    page.render(
                                        bitmap,
                                        null,
                                        null,
                                        PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY,
                                    )
                                    val out = ByteArrayOutputStream()
                                    bitmap.compress(Bitmap.CompressFormat.JPEG, 82, out)
                                    bitmap.recycle()
                                    val bytes = out.toByteArray()
                                    runOnUiThread { result.success(bytes) }
                                } finally {
                                    page.close()
                                }
                            }
                            "extractText" -> {
                                val path = pdfPath
                                    ?: throw IllegalStateException("pdf not open")
                                val pages = extractPageTexts(path)
                                runOnUiThread { result.success(pages) }
                            }
                            "close" -> {
                                closeInternal()
                                runOnUiThread { result.success(null) }
                            }
                            else -> runOnUiThread { result.notImplemented() }
                        }
                    } catch (e: Exception) {
                        runOnUiThread {
                            result.error("pdf_error", e.message, null)
                        }
                    }
                }
            }
    }

    private fun extractPageTexts(path: String): List<String> {
        PDDocument.load(File(path)).use { doc ->
            val stripper = PDFTextStripper()
            val out = ArrayList<String>(doc.numberOfPages)
            for (i in 1..doc.numberOfPages) {
                stripper.startPage = i
                stripper.endPage = i
                out.add(stripper.getText(doc).orEmpty())
            }
            return out
        }
    }

    private fun closeInternal() {
        synchronized(lock) {
            renderer?.close()
            renderer = null
            pfd?.close()
            pfd = null
            pdfPath = null
        }
    }

    override fun onDestroy() {
        closeInternal()
        super.onDestroy()
    }
}
