# PdfBox-Android optional JPEG2000 decoder — not on Maven, not needed for text search.
-dontwarn com.gemalto.jp2.JP2Decoder
-dontwarn com.gemalto.jp2.**

# Keep PDF text extraction used by in-reader search.
-keep class com.tom_roush.pdfbox.** { *; }
-dontwarn com.tom_roush.pdfbox.**
