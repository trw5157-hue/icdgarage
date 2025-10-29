import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const VoiceRecorder = ({ onRecordingComplete, existingRecording }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(existingRecording || null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);

        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64 = reader.result;
          if (onRecordingComplete) {
            onRecordingComplete(base64);
          }
        };

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone. Please grant permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      toast.success('Recording stopped');
    }
  };

  const deleteRecording = () => {
    setAudioURL(null);
    setRecordingTime(0);
    if (onRecordingComplete) {
      onRecordingComplete(null);
    }
    toast.info('Recording deleted');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {!isRecording && !audioURL && (
          <Button
            type="button"
            onClick={startRecording}
            className="bg-red-600 hover:bg-red-700"
            size="sm"
          >
            🎤 Record Voice Note
          </Button>
        )}

        {isRecording && (
          <>
            <Button
              type="button"
              onClick={stopRecording}
              className="bg-red-600 hover:bg-red-700 animate-pulse"
              size="sm"
            >
              ⏹️ Stop ({formatTime(recordingTime)})
            </Button>
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <span className="animate-pulse">●</span>
              <span>Recording...</span>
            </div>
          </>
        )}

        {audioURL && !isRecording && (
          <div className="flex items-center gap-2 flex-1">
            <audio src={audioURL} controls className="flex-1 h-10" />
            <Button
              type="button"
              onClick={deleteRecording}
              variant="outline"
              size="sm"
              className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
            >
              🗑️ Delete
            </Button>
          </div>
        )}
      </div>
      
      {audioURL && (
        <p className="text-xs text-green-500">
          ✓ Voice note recorded. It will be saved with the job.
        </p>
      )}
    </div>
  );
};

export default VoiceRecorder;
