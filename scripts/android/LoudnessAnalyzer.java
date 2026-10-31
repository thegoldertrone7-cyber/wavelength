package app.wavelength.music;

import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Best-effort loudness probe for the standalone Android build.
 *
 * The WebView plays YouTube audio straight from googlevideo, so the page cannot
 * read its samples through Web Audio. This class decodes the first few seconds
 * of the same stream with MediaCodec and returns an attenuation-only gain.
 * Anything it cannot decode fails open at 1.0 so playback is never affected.
 */
final class LoudnessAnalyzer {
    private LoudnessAnalyzer() {}

    private static final double TARGET_RMS = 0.10;
    private static final double MIN_GAIN = 0.55;
    private static final double SILENCE_RMS = 0.0004;

    /** Gain in [0.55, 1.0]. Never boosts above the user's own volume. */
    static double gainFor(String url) {
        if (url == null || url.isEmpty()) return 1;
        try {
            double rms = analyse(url, 4.0, 7000);
            if (!(rms > SILENCE_RMS)) return 1;
            double gain = TARGET_RMS / rms;
            return Math.max(MIN_GAIN, Math.min(1.0, gain));
        } catch (Throwable ignored) {
            return 1;
        }
    }

    private static double analyse(String url, double seconds, long deadlineMs) throws Exception {
        MediaExtractor extractor = new MediaExtractor();
        MediaCodec codec = null;
        try {
            extractor.setDataSource(url, null);
            int track = -1;
            MediaFormat format = null;
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat candidate = extractor.getTrackFormat(i);
                String mime = candidate.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("audio/")) {
                    track = i;
                    format = candidate;
                    break;
                }
            }
            if (track < 0 || format == null) return 0;
            extractor.selectTrack(track);

            String mime = format.getString(MediaFormat.KEY_MIME);
            if (mime == null) return 0;
            codec = MediaCodec.createDecoderByType(mime);
            codec.configure(format, null, null, 0);
            codec.start();

            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            long limitUs = (long) (seconds * 1_000_000);
            long endAt = System.currentTimeMillis() + deadlineMs;
            double sum = 0;
            long count = 0;
            long maxSamples = (long) (48000 * seconds * 2);
            int bytesPerSample = 2;
            boolean inputDone = false;

            while (count < maxSamples && System.currentTimeMillis() < endAt) {
                if (!inputDone) {
                    int inIndex = codec.dequeueInputBuffer(1500);
                    if (inIndex >= 0) {
                        ByteBuffer input = codec.getInputBuffer(inIndex);
                        int size = input == null ? -1 : extractor.readSampleData(input, 0);
                        if (size < 0) {
                            codec.queueInputBuffer(inIndex, 0, 0, 0,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputDone = true;
                        } else {
                            long ts = extractor.getSampleTime();
                            codec.queueInputBuffer(inIndex, 0, size, ts < 0 ? 0 : ts, 0);
                            extractor.advance();
                            if (ts > limitUs) {
                                int eos = codec.dequeueInputBuffer(10000);
                                if (eos >= 0) {
                                    codec.queueInputBuffer(eos, 0, 0, 0,
                                        MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                                }
                                inputDone = true;
                            }
                        }
                    }
                }

                int outIndex = codec.dequeueOutputBuffer(info, 1500);
                if (outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    MediaFormat out = codec.getOutputFormat();
                    int encoding = out.containsKey(MediaFormat.KEY_PCM_ENCODING)
                        ? out.getInteger(MediaFormat.KEY_PCM_ENCODING) : 2;
                    bytesPerSample = encoding == 4 ? 4 : 2;
                    continue;
                }
                if (outIndex >= 0) {
                    if (info.size > 0) {
                        ByteBuffer buffer = codec.getOutputBuffer(outIndex);
                        if (buffer != null) {
                            buffer.order(ByteOrder.LITTLE_ENDIAN);
                            buffer.position(info.offset);
                            buffer.limit(Math.min(buffer.capacity(), info.offset + info.size));
                            if (bytesPerSample == 4) {
                                while (buffer.remaining() >= 4) {
                                    float v = buffer.getFloat();
                                    if (v > 1f || v < -1f) v = 0f;
                                    sum += v * v;
                                    count++;
                                }
                            } else {
                                while (buffer.remaining() >= 2) {
                                    short s = buffer.getShort();
                                    double v = s / 32768.0;
                                    sum += v * v;
                                    count++;
                                }
                            }
                        }
                    }
                    codec.releaseOutputBuffer(outIndex, false);
                    if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) break;
                }
            }
            return count > 0 ? Math.sqrt(sum / count) : 0;
        } finally {
            if (codec != null) {
                try { codec.stop(); } catch (Exception ignored) {}
                try { codec.release(); } catch (Exception ignored) {}
            }
            try { extractor.release(); } catch (Exception ignored) {}
        }
    }
}
