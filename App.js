
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Alert, Image, Animated,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Share, Dimensions
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode, Audio } from "expo-av";

const API_KEY = "AIzaSyCoE-u18gD7wBg20dtLBtctQbM6KHzUFtk";
const DATABASE_URL = "https://gen-video-live-default-rtdb.asia-southeast1.firebasedatabase.app";
const CLOUD_NAME = "esfbp8hc";
const UPLOAD_PRESET = "gen_video_live_upload";

const C = {
  bg: "#10101a",
  card: "#1c1c2b",
  card2: "#25253a",
  pink: "#ff315f",
  magenta: "#ff4fc8",
  white: "#ffffff",
  gray: "#aaaabd",
  green: "#38d996",
  gold: "#e7b94b"
};

const SCREEN_HEIGHT = Dimensions.get("window").height;

// Profile/feed mein sirf asli playable video posts dikhayein.
function isRealVideoPost(post) {
  return !!(post && typeof post.videoUrl === "string" && /^https?:\/\//i.test(post.videoUrl));
}

// Profile grid thumbnail is generated from the exact uploaded video URL.
// Do not use manually selected cover images or demo/sample artwork here.
function getVideoThumbnail(post) {
  const url = post?.videoUrl || "";
  if (!/^https?:\/\//i.test(url)) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/video/upload/")) return "";
  return url
    .replace("/video/upload/", "/video/upload/so_0,w_480,h_720,c_fill/")
    .replace(/\.(mp4|mov|m4v|webm)(\?.*)?$/i, ".jpg");
}

function Button({ title, onPress, secondary, disabled, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.button, secondary && styles.secondaryButton, disabled && {opacity:0.5}, style]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

function NavItem({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Text style={[styles.navIcon,{color:active?C.pink:C.white}]}>{icon}</Text>
      <Text style={[styles.navLabel,{color:active?C.pink:C.gray}]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SpinningDisc({ avatarUrl }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin,{
        toValue:1,duration:5000,useNativeDriver:true
      })
    );
    animation.start();
    return () => animation.stop();
  },[spin]);

  const rotate = spin.interpolate({
    inputRange:[0,1],
    outputRange:["0deg","360deg"]
  });

  return (
    <Animated.View style={[styles.disc,{transform:[{rotate}]}]}>
      <View style={styles.discCenter}>
        {avatarUrl ? (
          <Image source={{uri:avatarUrl}} style={styles.discAvatar}/>
        ) : (
          <Text>👑</Text>
        )}
      </View>
    </Animated.View>
  );
}

// REEL CARD
function ReelCard({
  reel,height,liked,saved,following,isActive,
  onLike,onSave,onFollow,onComment,onShare,onSound
}) {
  return (
    <View style={[styles.reelPage,{height,backgroundColor:reel.background||"#21172d"}]}>
      {reel.videoUrl ? (
        <Video
          source={{uri:reel.videoUrl}}
          style={styles.reelVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay={!!isActive}
          isMuted={!isActive}
          volume={isActive?1:0}
          isLooping
          useNativeControls={false}
        />
      ) : (
        <View style={styles.reelCenter}>
          <Text style={styles.reelEmoji}>{reel.emoji||"🎬"}</Text>
          <Text style={styles.demoLabel}>Sample Reel</Text>
        </View>
      )}

      <View style={styles.reelBottom}>
        <Text style={styles.creatorName}>@{reel.creator||"Creator"}</Text>
        <Text style={styles.caption}>{reel.caption||""}</Text>
        <TouchableOpacity style={styles.audioLine} onPress={onSound}>
          <Text style={styles.musicNote}>♫</Text>
          <Text style={styles.music}>{reel.music||"Original Sound"}</Text>
          <Text style={styles.audioArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionStack}>
        <View style={styles.creatorFollow}>
          <View style={styles.creatorAvatarRing}>
            {reel.avatarUrl ? (
              <Image source={{uri:reel.avatarUrl}} style={styles.creatorAvatarImage}/>
            ) : (
              <View style={styles.creatorAvatarFallback}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.followPlus,following&&styles.followedButton]}
            onPress={onFollow}
          >
            <Text style={styles.followPlusText}>{following?"✓":"+"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={onLike}>
          <Text style={styles.actionIcon}>{liked?"❤️":"🤍"}</Text>
          <Text style={styles.actionCount}>
            {(Number(reel.likes||0)+(liked?1:0)).toLocaleString()}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onComment}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>Comment</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onSave}>
          <Text style={styles.actionIcon}>{saved?"🔖":"📑"}</Text>
          <Text style={styles.actionCount}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onShare}>
          <Text style={styles.actionIcon}>↗️</Text>
          <Text style={styles.actionCount}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.discButton} onPress={onSound}>
          <SpinningDisc avatarUrl={reel.avatarUrl}/>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [signupUsername,setSignupUsername] = useState("");
  const [isSignup,setIsSignup] = useState(false);
  const [loading,setLoading] = useState(false);

  const [user,setUser] = useState(null);
  const [username,setUsername] = useState("");
  const [bio,setBio] = useState("Welcome to my Gen Video Live profile! 👑");
  const [location,setLocation] = useState("");
  const [profileImage,setProfileImage] = useState("");
  const [coverImage,setCoverImage] = useState("");
  const [editUsername,setEditUsername] = useState("");
  const [editBio,setEditBio] = useState("");
  const [editLocation,setEditLocation] = useState("");
  const [editProfileImage,setEditProfileImage] = useState("");
  const [editCoverImage,setEditCoverImage] = useState("");
  const [userProfiles,setUserProfiles] = useState({});

  const [page,setPage] = useState("Home");
  const [feedTab,setFeedTab] = useState("For You");
  const [profileTab,setProfileTab] = useState("Videos");

  const [posts,setPosts] = useState([]);
  const [following,setFollowing] = useState({});
  const [followerCount,setFollowerCount] = useState(0);
  const [liked,setLiked] = useState({});
  const [saved,setSaved] = useState({});

  const [selectedVideo,setSelectedVideo] = useState(null);
  const [caption,setCaption] = useState("");
  const [privacy,setPrivacy] = useState("Public");
  const [uploading,setUploading] = useState(false);
  const [uploadProgress,setUploadProgress] = useState(0);
  const [uploadStage,setUploadStage] = useState("");
  // Create/upload workflow pages and post metadata
  const [createStep,setCreateStep] = useState("camera");
  const [createPhotos,setCreatePhotos] = useState([]);
  const [galleryTab,setGalleryTab] = useState("All");
  const [drafts,setDrafts] = useState([]);
  const [soundReturnPage,setSoundReturnPage] = useState("Home");
  const [postCoverImage,setPostCoverImage] = useState(null);
  const [postHashtags,setPostHashtags] = useState("");
  const [postMention,setPostMention] = useState("");
  const [postLocation,setPostLocation] = useState("");
  const [postLink,setPostLink] = useState("");
  const [allowComments,setAllowComments] = useState(true);
  const [allowReuse,setAllowReuse] = useState(true);
  const [videoLanguage,setVideoLanguage] = useState("English");
  const [aiGenerated,setAiGenerated] = useState(false);
  const [saveAsDraft,setSaveAsDraft] = useState(false);

  const [selectedSound,setSelectedSound] = useState("");
  const [soundTitle,setSoundTitle] = useState("Dil Se Dil Tak");
  const [soundCreator,setSoundCreator] = useState("Gen Video Live");
  const [soundAvatarUrl,setSoundAvatarUrl] = useState("");
  const [playingPost,setPlayingPost] = useState(null);

  const [activeReelIndex,setActiveReelIndex] = useState(0);
  const [feedHeight,setFeedHeight] = useState(0);
  const feedScrollRef = useRef(null);

  const liveUnlocked = followerCount >= 1000;
  const statusHeight = Platform.OS==="android"?(StatusBar.currentHeight||0):0;
  const reelHeight = feedHeight || SCREEN_HEIGHT-62-66-statusHeight;

  useEffect(()=>{
    Audio.setAudioModeAsync({
      playsInSilentModeIOS:true,
      shouldDuckAndroid:false,
      playThroughEarpieceAndroid:false,
      staysActiveInBackground:false
    }).catch(error=>console.log("AUDIO MODE ERROR:",error));
  },[]);

  // Authentication
  async function authenticate() {
    if(isSignup&&!signupUsername.trim())
      return Alert.alert("Username required","Apna username likhein.");

    if(!email.trim()||!password.trim())
      return Alert.alert("Required","Email aur password dono likhein.");

    if(password.length<6)
      return Alert.alert("Password","Password kam az kam 6 characters ka hona chahiye.");

    setLoading(true);

    try {
      const endpoint = isSignup?"signUp":"signInWithPassword";
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${API_KEY}`,
        {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            email:email.trim(),
            password,
            returnSecureToken:true
          })
        }
      );

      const data = await response.json();
      if(!response.ok) throw new Error(data.error?.message||"Authentication failed.");

      let finalUsername = data.displayName||"";

      if(isSignup) {
        finalUsername = signupUsername.trim();
        const updateResponse = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
          {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({
              idToken:data.idToken,
              displayName:finalUsername,
              returnSecureToken:true
            })
          }
        );

        const updateData = await updateResponse.json();
        if(!updateResponse.ok)
          throw new Error(updateData.error?.message||"Username save nahi hua.");
      }

      if(!finalUsername) finalUsername=data.email?.split("@")[0]||"User";

      setUser({email:data.email,id:data.localId,token:data.idToken});
      setUsername(finalUsername);
      setEditUsername(finalUsername);
      setEditBio(bio);
      setPage("Home");
      setIsSignup(false);

      Alert.alert("Welcome!",isSignup?"Account create ho gaya.":"Login successful.");
    } catch(error) {
      let message=error.message||"Dobara try karein.";
      if(message.includes("EMAIL_EXISTS")) message="Yeh email pehle se registered hai.";
      else if(message.includes("INVALID_LOGIN_CREDENTIALS")||message.includes("EMAIL_NOT_FOUND")||message.includes("INVALID_PASSWORD")) message="Email ya password ghalat hai.";
      else if(message.includes("WEAK_PASSWORD")) message="Password kam az kam 6 characters ka rakhein.";
      else if(message.includes("INVALID_EMAIL")) message="Email address check karein.";
      Alert.alert("Error",message);
    } finally {
      setLoading(false);
    }
  }

  // Load own profile and other creators' public profile data
  async function loadMyProfile() {
    if(!user?.token) return;

    try {
      const response=await fetch(
        `${DATABASE_URL}/users/${user.id}.json?auth=${encodeURIComponent(user.token)}`
      );
      const data=await response.json();

      if(!response.ok) throw new Error(data?.error||"Profile load nahi hua.");

      if(data&&typeof data==="object") {
        setUsername(data.username||username);
        setBio(data.bio||"Welcome to my Gen Video Live profile! 👑");
        setLocation(data.location||"");
        setProfileImage(data.profileImage||"");
        setCoverImage(data.coverImage||"");
        setEditUsername(data.username||username);
        setEditBio(data.bio||"Welcome to my Gen Video Live profile! 👑");
        setEditLocation(data.location||"");
        setEditProfileImage(data.profileImage||"");
        setEditCoverImage(data.coverImage||"");
        setUserProfiles(old=>({...old,[user.id]:data}));
      } else {
        setEditUsername(username);
        setEditBio(bio);
        setEditLocation("");
        setEditProfileImage("");
        setEditCoverImage("");
      }
    } catch(error) {
      console.log("PROFILE LOAD ERROR:",error.message);
    }
  }

  // Load posts from Firebase
  async function loadPosts() {
    if(!user?.token) return;

    try {
      const response = await fetch(
        `${DATABASE_URL}/posts.json?auth=${encodeURIComponent(user.token)}`
      );
      const data = await response.json();

      if(!response.ok) {
        throw new Error(typeof data==="string"?data:(data?.error||"Posts load nahi hue."));
      }

      const list = data&&typeof data==="object"
        ? Object.entries(data)
            .filter(([id,post])=>post&&typeof post==="object")
            .map(([id,post])=>({id,...post}))
            .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))
        : [];

      setPosts(list);

      // Public creator profiles are used to show each creator's own photo.
      const profileResponse=await fetch(
        `${DATABASE_URL}/users.json?auth=${encodeURIComponent(user.token)}`
      );
      const profileData=await profileResponse.json();

      if(profileResponse.ok&&profileData&&typeof profileData==="object") {
        setUserProfiles(profileData);
      }

      console.log("POSTS LOADED:",list.length);
    } catch(error) {
      console.log("POST LOAD ERROR:",error.message);
      Alert.alert(
        "Posts load nahi hue",
        `${error.message}\n\nFirebase Database Rules check karein.`
      );
    }
  }

  async function loadLikeSave() {
    if(!user?.token) return;

    try {
      const [likeResponse,saveResponse] = await Promise.all([
        fetch(`${DATABASE_URL}/userLikes/${user.id}.json?auth=${encodeURIComponent(user.token)}`),
        fetch(`${DATABASE_URL}/userSaves/${user.id}.json?auth=${encodeURIComponent(user.token)}`)
      ]);

      const likeData = await likeResponse.json();
      const saveData = await saveResponse.json();

      if(!likeResponse.ok) throw new Error("Likes load nahi hue.");
      if(!saveResponse.ok) throw new Error("Saved videos load nahi huin.");

      setLiked(likeData&&typeof likeData==="object"?likeData:{});
      setSaved(saveData&&typeof saveData==="object"?saveData:{});
    } catch(error) {
      console.log("LIKE/SAVE LOAD ERROR:",error.message);
    }
  }

  async function loadFollowerCount() {
    if(!user?.token) return;

    try {
      const response = await fetch(
        `${DATABASE_URL}/followers/${user.id}.json?auth=${encodeURIComponent(user.token)}`
      );
      const data = await response.json();
      if(!response.ok) throw new Error("Follower count load nahi hua.");
      setFollowerCount(data&&typeof data==="object"?Object.keys(data).length:0);
    } catch(error) {
      console.log("FOLLOWER ERROR:",error.message);
    }
  }

  async function loadFollowing() {
    if(!user?.token) return;

    try {
      const response = await fetch(
        `${DATABASE_URL}/following/${user.id}.json?auth=${encodeURIComponent(user.token)}`
      );
      const data = await response.json();
      if(!response.ok) throw new Error("Following load nahi hui.");
      setFollowing(data&&typeof data==="object"?data:{});
    } catch(error) {
      console.log("FOLLOWING ERROR:",error.message);
    }
  }

  useEffect(()=>{
    if(user?.token) {
      loadMyProfile();
      loadPosts();
      loadFollowerCount();
      loadFollowing();
      loadLikeSave();
    }
  },[user]);

  useEffect(()=>{
    setActiveReelIndex(0);
    const timer = setTimeout(()=>{
      feedScrollRef.current?.scrollTo({y:0,animated:false});
    },100);
    return ()=>clearTimeout(timer);
  },[feedTab]);

  async function toggleLike(id) {
    const wasLiked=!!liked[id];
    const nextValue=!wasLiked;

    setLiked(old=>({...old,[id]:nextValue}));

    if(id.startsWith("demo")) return;
    if(!user?.token) return;

    try {
      const url=`${DATABASE_URL}/userLikes/${user.id}/${id}.json?auth=${encodeURIComponent(user.token)}`;

      const response=await fetch(url,{
        method:nextValue?"PUT":"DELETE",
        headers:{"Content-Type":"application/json"},
        ...(nextValue?{body:"true"}:{})
      });

      if(!response.ok) throw new Error("Like save nahi hua.");
    } catch(error) {
      setLiked(old=>({...old,[id]:wasLiked}));
      Alert.alert("Like Error","Like Firebase mein save nahi hua. Database Rules check karein.");
    }
  }

  async function toggleSave(id) {
    const wasSaved=!!saved[id];
    const nextValue=!wasSaved;

    setSaved(old=>({...old,[id]:nextValue}));

    if(id.startsWith("demo")) return;
    if(!user?.token) return;

    try {
      const url=`${DATABASE_URL}/userSaves/${user.id}/${id}.json?auth=${encodeURIComponent(user.token)}`;

      const response=await fetch(url,{
        method:nextValue?"PUT":"DELETE",
        headers:{"Content-Type":"application/json"},
        ...(nextValue?{body:"true"}:{})
      });

      if(!response.ok) throw new Error("Save nahi hua.");
    } catch(error) {
      setSaved(old=>({...old,[id]:wasSaved}));
      Alert.alert("Save Error","Video save nahi hui. Database Rules check karein.");
    }
  }

  async function toggleFollow(reel) {
    if(!user?.token) return Alert.alert("Login required","Pehle login karein.");
    if(!reel.ownerId) return Alert.alert("Follow unavailable","Yeh demo creator connected nahi hai.");
    if(reel.ownerId===user.id) return Alert.alert("Follow","Aap apne account ko follow nahi kar sakte.");

    const creatorId=reel.ownerId;
    const wasFollowing=!!following[creatorId];

    try {
      const followerPath=`${DATABASE_URL}/followers/${creatorId}/${user.id}.json?auth=${encodeURIComponent(user.token)}`;
      const followingPath=`${DATABASE_URL}/following/${user.id}/${creatorId}.json?auth=${encodeURIComponent(user.token)}`;

      if(wasFollowing) {
        const a=await fetch(followerPath,{method:"DELETE"});
        const b=await fetch(followingPath,{method:"DELETE"});
        if(!a.ok||!b.ok) throw new Error("Unfollow failed");

        setFollowing(old=>{
          const updated={...old};
          delete updated[creatorId];
          return updated;
        });
      } else {
        const record={username,createdAt:Date.now()};
        const a=await fetch(followerPath,{
          method:"PUT",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(record)
        });
        const b=await fetch(followingPath,{
          method:"PUT",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({username:reel.creator||"Creator",createdAt:Date.now()})
        });

        if(!a.ok||!b.ok) throw new Error("Follow failed");
        setFollowing(old=>({...old,[creatorId]:record}));
      }

      await loadFollowerCount();
    } catch(error) {
      Alert.alert("Follow Error","Firebase Database rules check karein.");
      await loadFollowing();
    }
  }

  async function chooseVideoFromGallery() {
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted)
        return Alert.alert("Permission","Gallery permission allow karein.");

      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["videos"],
        allowsEditing:false,
        quality:1,
        videoMaxDuration:180
      });

      if(!result.canceled&&result.assets?.length) {
        setSelectedVideo(result.assets[0]);
        Alert.alert("Video selected",result.assets[0].fileName||"Video select ho gayi.");
      }
    } catch(error) {
      Alert.alert("Video Picker Error",error.message||"Video select nahi ho saki.");
    }
  }

  async function recordVideo() {
    try {
      const permission=await ImagePicker.requestCameraPermissionsAsync();
      if(!permission.granted)
        return Alert.alert("Permission","Camera permission allow karein.");

      const result=await ImagePicker.launchCameraAsync({
        mediaTypes:["videos"],
        videoMaxDuration:180,
        quality:1
      });

      if(!result.canceled&&result.assets?.length) {
        setSelectedVideo(result.assets[0]);
        setCreateStep("selected");
        Alert.alert("Video selected","Camera video select ho gayi.");
      }
    } catch(error) {
      Alert.alert("Camera Error",error.message||"Camera start nahi hua.");
    }
  }

  // Profile photo picker
  async function chooseProfileImage() {
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted)
        return Alert.alert("Permission","Gallery permission allow karein.");

      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images"],
        allowsEditing:true,
        aspect:[1,1],
        quality:0.8
      });

      if(!result.canceled&&result.assets?.length) {
        setEditProfileImage(result.assets[0].uri);
      }
    } catch(error) {
      Alert.alert("Image Picker Error",error.message||"Profile image select nahi hui.");
    }
  }

  // Cover photo picker
  async function chooseCoverImage() {
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted)
        return Alert.alert("Permission","Gallery permission allow karein.");

      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images"],
        allowsEditing:true,
        aspect:[16,9],
        quality:0.8
      });

      if(!result.canceled&&result.assets?.length) {
        setEditCoverImage(result.assets[0].uri);
      }
    } catch(error) {
      Alert.alert("Image Picker Error",error.message||"Cover image select nahi hui.");
    }
  }

  async function choosePostCoverImage() {
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted) return Alert.alert("Permission","Gallery permission allow karein.");
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,aspect:[16,9],quality:0.85});
      if(!result.canceled && result.assets?.length) setPostCoverImage(result.assets[0].uri);
    } catch(error) { Alert.alert("Cover Error",error.message||"Cover select nahi hui."); }
  }

  async function chooseAllMediaForPost() {
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted) return Alert.alert("Permission","Gallery permission allow karein.");
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images","videos"], allowsMultipleSelection:true,
        selectionLimit:10, quality:1
      });
      if(!result.canceled && result.assets?.length) {
        const videos=result.assets.filter(asset=>asset.type==="video" || asset.mimeType?.startsWith("video/"));
        const photos=result.assets.filter(asset=>asset.type==="image" || asset.mimeType?.startsWith("image/"));
        if(videos.length) setSelectedVideo(videos[0]);
        setCreatePhotos(photos);
        if(videos.length>1) Alert.alert("Media selected",`${videos.length} videos aur ${photos.length} photos select huin. Upload ke liye pehli video use hogi.`);
      }
    } catch(error) { Alert.alert("Gallery Error",error.message||"Media select nahi ho saka."); }
  }

  async function choosePhotosForPost() {
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted) return Alert.alert("Permission","Gallery permission allow karein.");
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images"], allowsMultipleSelection:true, quality:0.9, selectionLimit:10
      });
      if(!result.canceled && result.assets?.length) setCreatePhotos(result.assets);
    } catch(error) { Alert.alert("Gallery Error",error.message||"Photos select nahi ho sakin."); }
  }

  function nextCreateStep(step) { setCreateStep(step); }

  function getVideoFileName(asset) {
    if(asset.fileName) return asset.fileName;
    const extension=asset.mimeType?.includes("quicktime")?"mov":"mp4";
    return `gen-video-${Date.now()}.${extension}`;
  }

  // Cloudinary video upload
  function uploadToCloudinary(formData) {
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();

      xhr.open(
        "POST",
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`
      );

      xhr.timeout=10*60*1000;

      xhr.upload.onprogress=(event)=>{
        if(event.lengthComputable) {
          const percent=Math.round((event.loaded/event.total)*100);
          setUploadProgress(percent);
        }
      };

      xhr.onload=()=>{
        let data={};
        try {
          data=JSON.parse(xhr.responseText||"{}");
        } catch(e) {
          reject(new Error("Cloudinary ka response samajh nahi aaya."));
          return;
        }

        if(xhr.status>=200&&xhr.status<300&&data.secure_url) {
          resolve(data);
        } else {
          reject(new Error(
            data?.error?.message||`Cloudinary upload failed. Status: ${xhr.status}`
          ));
        }
      };

      xhr.onerror=()=>reject(new Error("Internet connection error. Upload complete nahi hui."));
      xhr.ontimeout=()=>reject(new Error("Upload mein bohat waqt lag gaya. Dobara try karein."));
      xhr.onabort=()=>reject(new Error("Upload cancel ho gayi."));
      xhr.send(formData);
    });
  }

  // Cloudinary image upload for profile and cover photos
  async function uploadImageToCloudinary(uri,label) {
    const formData=new FormData();

    formData.append("file",{
      uri,
      name:`${label}-${Date.now()}.jpg`,
      type:"image/jpeg"
    });

    formData.append("upload_preset",UPLOAD_PRESET);

    const response=await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method:"POST",
        body:formData
      }
    );

    const data=await response.json();

    if(!response.ok||!data.secure_url) {
      throw new Error(data?.error?.message||"Image Cloudinary par upload nahi hui.");
    }

    return data.secure_url;
  }

  function saveCurrentDraft() {
    if(!selectedVideo?.uri && !caption.trim() && !createPhotos.length) {
      return Alert.alert("Empty Draft","Pehle video, photos ya caption add karein.");
    }
    const draft={
      id:`draft-${Date.now()}`, video:selectedVideo, caption, privacy, photos:createPhotos,
      cover:postCoverImage, hashtags:postHashtags, mention:postMention,
      postLocation, link:postLink, sound:selectedSound, savedAt:Date.now()
    };
    setDrafts(old=>[draft,...old]);
    Alert.alert("Draft saved","Draft is app ki current session mein save ho gaya hai. App band/reload karne par yeh draft nahi rahega.");
    setCreateStep("camera");
  }

  function openDrafts() {
    if(!drafts.length) return Alert.alert("Drafts","Abhi koi draft save nahi hai.");
    Alert.alert("Your Drafts",`${drafts.length} draft(s) saved in this session.`,[
      ...drafts.slice(0,4).map((draft,index)=>({
        text:`${index+1}. ${draft.caption?.trim()?.slice(0,24)||draft.video?.fileName||"Untitled draft"}`,
        onPress:()=>{
          setSelectedVideo(draft.video||null); setCaption(draft.caption||"");
          setPrivacy(draft.privacy||"Public"); setCreatePhotos(draft.photos||[]);
          setPostCoverImage(draft.cover||null); setPostHashtags(draft.hashtags||"");
          setPostMention(draft.mention||""); setPostLocation(draft.postLocation||"");
          setPostLink(draft.link||""); setSelectedSound(draft.sound||"");
          setCreateStep("post");
        }
      })),
      {text:"Close",style:"cancel"}
    ]);
  }

  async function uploadVideoPost() {
    if(!user?.token) return Alert.alert("Login required","Pehle login karein.");
    if(!selectedVideo?.uri) return Alert.alert("Video required","Pehle Gallery ya Camera se video select karein.");
    if(!caption.trim()) return Alert.alert("Caption required","Apni video ka caption likhein.");
    if(uploading) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadStage("Video upload shuru ho rahi hai...");

    let cloudinaryUploaded=false;

    try {
      const formData=new FormData();

      formData.append("file",{
        uri:selectedVideo.uri,
        name:getVideoFileName(selectedVideo),
        type:selectedVideo.mimeType||"video/mp4"
      });

      formData.append("upload_preset",UPLOAD_PRESET);

      setUploadStage("Video Cloudinary par upload ho rahi hai...");

      const cloudData=await uploadToCloudinary(formData);
      cloudinaryUploaded=true;

      setUploadProgress(100);
      setUploadStage("Video upload ho gayi! Ab post save ho rahi hai...");

      let finalCoverUrl=postCoverImage||"";
      if(finalCoverUrl && !finalCoverUrl.startsWith("http")) {
        setUploadStage("Cover image upload ho rahi hai...");
        finalCoverUrl=await uploadImageToCloudinary(finalCoverUrl,"post-cover");
      }

      const postData={
        ownerId:user.id,
        creator:username,
        avatarUrl:profileImage||"",
        location:location||"",
        caption:caption.trim(),
        privacy,
        videoUrl:cloudData.secure_url,
        coverUrl:finalCoverUrl,
        cloudinaryPublicId:cloudData.public_id||"",
        resourceType:cloudData.resource_type||"video",
        format:cloudData.format||"",
        duration:cloudData.duration||null,
        music:selectedSound||"Original Sound",
        hashtags:postHashtags.trim(),
        mention:postMention.trim(),
        postLocation:postLocation.trim(),
        link:postLink.trim(),
        allowComments,
        allowReuse,
        videoLanguage,
        aiGenerated,
        createdAt:Date.now()
      };

      const firebaseResponse=await fetch(
        `${DATABASE_URL}/posts.json?auth=${encodeURIComponent(user.token)}`,
        {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(postData)
        }
      );

      const firebaseData=await firebaseResponse.json();

      if(!firebaseResponse.ok||!firebaseData.name) {
        throw new Error(firebaseData?.error||"Firebase post save nahi kar saka. Database rules check karein.");
      }

      const newPost={id:firebaseData.name,...postData};

      setPosts(old=>[newPost,...old.filter(post=>post.id!==newPost.id)]);

      setSelectedVideo(null);
      setCaption("");
      setPrivacy("Public");
      setCreateStep("camera");
      setCreatePhotos([]);
      setPostCoverImage(null); setPostHashtags(""); setPostMention(""); setPostLocation(""); setPostLink("");
      setSelectedSound("");
      setUploadProgress(100);
      setUploadStage("Upload complete!");

      await loadPosts();

      Alert.alert(
        "🎉 Upload Successful!",
        "Mubarak ho! Aapki video upload aur publish ho gayi hai.",
        [
          {
            text:"View My Video",
            onPress:()=>{
              setProfileTab(postData.privacy==="Private"?"Private":"Videos");
              setPage("Profile");
              loadPosts();
            }
          },
          {
            text:"OK",
            onPress:()=>{
              setPage("Home");
              setFeedTab("For You");
            }
          }
        ]
      );

    } catch(error) {
      console.log("UPLOAD ERROR:",error);

      const extra=cloudinaryUploaded
        ? "\n\nVideo Cloudinary par upload ho chuki hai, lekin Firebase mein post save nahi hui. Database rules aur login token check karein."
        : "";

      Alert.alert(
        "❌ Upload Failed",
        (error.message||"Upload nahi ho saki.")+extra
      );
    } finally {
      setUploading(false);
      setUploadStage("");
      setUploadProgress(0);
    }
  }

  // Save profile details and images
  async function saveProfile() {
    if(!editUsername.trim())
      return Alert.alert("Username","Username khali nahi ho sakta.");
    if(!user?.token) return;

    setLoading(true);

    try {
      let finalProfileImage=editProfileImage;
      let finalCoverImage=editCoverImage;

      // Upload only newly selected local images.
      if(editProfileImage&& !editProfileImage.startsWith("http")) {
        finalProfileImage=await uploadImageToCloudinary(editProfileImage,"profile");
      }

      if(editCoverImage&& !editCoverImage.startsWith("http")) {
        finalCoverImage=await uploadImageToCloudinary(editCoverImage,"cover");
      }

      const response=await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
        {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            idToken:user.token,
            displayName:editUsername.trim(),
            returnSecureToken:true
          })
        }
      );

      const data=await response.json();
      if(!response.ok) throw new Error(data.error?.message||"Username update failed.");

      const profileData={
        username:editUsername.trim(),
        bio:editBio.trim(),
        location:editLocation.trim(),
        profileImage:finalProfileImage||"",
        coverImage:finalCoverImage||"",
        updatedAt:Date.now()
      };

      const profileResponse=await fetch(
        `${DATABASE_URL}/users/${user.id}.json?auth=${encodeURIComponent(data.idToken||user.token)}`,
        {
          method:"PUT",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(profileData)
        }
      );

      const profileResult=await profileResponse.json();
      if(!profileResponse.ok) {
        throw new Error(profileResult?.error||"Profile Firebase mein save nahi hua.");
      }

      setUsername(profileData.username);
      setBio(profileData.bio);
      setLocation(profileData.location);
      setProfileImage(profileData.profileImage);
      setCoverImage(profileData.coverImage);
      setEditProfileImage(profileData.profileImage);
      setEditCoverImage(profileData.coverImage);
      setUser(old=>({...old,token:data.idToken||old.token}));
      setUserProfiles(old=>({...old,[user.id]:profileData}));

      setPage("Profile");
      Alert.alert("Saved","Aapki profile save ho gayi hai.");
    } catch(error) {
      Alert.alert("Profile Error",error.message||"Profile save nahi hui.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    Alert.alert("Log out","Kya aap logout karna chahte hain?",[
      {text:"Cancel",style:"cancel"},
      {
        text:"Log out",
        style:"destructive",
        onPress:()=>{
          setUser(null);
          setEmail("");
          setPassword("");
          setSignupUsername("");
          setUsername("");
          setBio("Welcome to my Gen Video Live profile! 👑");
          setLocation("");
          setProfileImage("");
          setCoverImage("");
          setEditProfileImage("");
          setEditCoverImage("");
          setUserProfiles({});
          setPosts([]);
          setFollowing({});
          setFollowerCount(0);
          setLiked({});
          setSaved({});
          setSelectedVideo(null);
          setActiveReelIndex(0);
          setPage("Home");
        }
      }
    ]);
  }

  function openSound(reel) {
    setSoundReturnPage("Home");
    setSoundTitle(reel.music||"Original Sound");
    setSoundCreator(reel.creator||"Gen Video Live");
    setSoundAvatarUrl(reel.avatarUrl||"");
    setPage("Sound");
  }

  function openLive() {
    if(!liveUnlocked)
      return Alert.alert("Live Locked 🔒",`Live feature 1,000 followers ke baad unlock hoga.\nAapke followers: ${followerCount}`);
    Alert.alert("Live","Live streaming abhi connect nahi hui.");
  }

  async function shareReel(reel) {
    try {
      await Share.share({
        message:`${reel.caption||"Watch this on Gen Video Live"}\n${reel.videoUrl||""}`
      });
    } catch(error) {
      Alert.alert("Share","Share nahi ho saka.");
    }
  }

  function showPlaceholder(title) {
    Alert.alert(title,"Yeh feature aglay development step mein add hoga.");
  }

  // Attach the correct creator's current profile image to their reels.
  const publicPosts=posts.filter(post=>post.privacy!=="Private" && isRealVideoPost(post));

  const allReels=publicPosts.map(reel=>{
    const creatorProfile=reel.ownerId?userProfiles[reel.ownerId]:null;
    const ownPhoto=reel.ownerId===user?.id?profileImage:"";

    return {
      ...reel,
      avatarUrl:creatorProfile?.profileImage||ownPhoto||reel.avatarUrl||""
    };
  });

  const visibleReels=feedTab==="Following"
    ? allReels.filter(reel=>reel.ownerId&&following[reel.ownerId])
    : allReels;

  const myPosts=posts.filter(post=>post.ownerId===user?.id && isRealVideoPost(post));
  const myPublicPosts=myPosts.filter(post=>post.privacy!=="Private");
  const privatePosts=myPosts.filter(post=>post.privacy==="Private");

  function renderHeader() {
    return (
      <View style={styles.header}>
        <Text style={styles.logo}>👑 Gen-Live</Text>
        <View style={styles.headerTabs}>
          {["Following","For You"].map(tab=>(
            <TouchableOpacity key={tab} onPress={()=>setFeedTab(tab)}>
              <Text style={[styles.headerTab,feedTab===tab&&styles.headerTabActive]}>{tab}</Text>
              {feedTab===tab&&<View style={styles.tabUnderline}/>}
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.liveButton} onPress={openLive}>
          <Text style={styles.liveText}>{liveUnlocked?"🔴 LIVE":"🔒 LIVE"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderLogin() {
    return (
      <KeyboardAvoidingView style={styles.authScreen} behavior={Platform.OS==="ios"?"padding":undefined}>
        <StatusBar backgroundColor={C.bg} barStyle="light-content"/>
        <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.crown}>👑</Text>
          <Text style={styles.authTitle}>Gen Video Live</Text>
          <Text style={styles.authSubtitle}>Watch • Create • Connect</Text>

          <View style={styles.authCard}>
            <Text style={styles.sectionTitle}>{isSignup?"Create Account":"Welcome Back"}</Text>

            {isSignup&&(
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={C.gray}
                value={signupUsername}
                onChangeText={setSignupUsername}
                autoCapitalize="none"
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={C.gray}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Password (6+ characters)"
              placeholderTextColor={C.gray}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Button
              title={loading?"Please wait...":isSignup?"Create Account":"Login"}
              onPress={authenticate}
              disabled={loading}
            />

            {loading&&<ActivityIndicator color={C.magenta} style={{marginTop:12}}/>}

            <TouchableOpacity onPress={()=>setIsSignup(!isSignup)} style={{marginTop:22}}>
              <Text style={styles.switchText}>
                {isSignup?"Already have an account? Login":"New here? Create an account"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.smallMuted}>Urdu • English</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  function renderHome() {
    return (
      <View style={styles.screen}>
        {renderHeader()}

        <View
          style={styles.reelScroll}
          onLayout={event=>{
            const height=event.nativeEvent.layout.height;
            if(height>0&&Math.abs(height-feedHeight)>1) {
              setFeedHeight(height);
            }
          }}
        >
          <ScrollView
            ref={feedScrollRef}
            style={{flex:1}}
            pagingEnabled
            snapToInterval={reelHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            onMomentumScrollEnd={event=>{
              const index=Math.round(event.nativeEvent.contentOffset.y/reelHeight);
              setActiveReelIndex(Math.max(0,Math.min(index,visibleReels.length-1)));
            }}
            onScrollEndDrag={event=>{
              const index=Math.round(event.nativeEvent.contentOffset.y/reelHeight);
              setActiveReelIndex(Math.max(0,Math.min(index,visibleReels.length-1)));
            }}
            scrollEventThrottle={16}
          >
            {visibleReels.map((reel,index)=>(
              <ReelCard
                key={reel.id}
                reel={reel}
                height={reelHeight}
                isActive={page==="Home"&&index===activeReelIndex}
                liked={!!liked[reel.id]}
                saved={!!saved[reel.id]}
                following={!!(reel.ownerId&&following[reel.ownerId])}
                onLike={()=>toggleLike(reel.id)}
                onSave={()=>toggleSave(reel.id)}
                onFollow={()=>toggleFollow(reel)}
                onComment={()=>showPlaceholder("Comments")}
                onShare={()=>shareReel(reel)}
                onSound={()=>openSound(reel)}
              />
            ))}

            {visibleReels.length===0&&(
              <View style={[styles.emptyFeed,{height:reelHeight}]}>
                <Text style={{fontSize:42}}>👥</Text>
                <Text style={styles.emptyText}>Following feed mein abhi videos nahi hain. Creators ko follow karein.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    );
  }

  function renderExplore() {
    return (
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent}>
        <Text style={styles.pageTitle}>Explore 🔍</Text>
        <Text style={styles.pageSubtitle}>Discover creators and trending videos</Text>
        <Text style={styles.sectionTitle}>Trending Reels</Text>

        {allReels.map(reel=>(
          <TouchableOpacity
            key={reel.id}
            style={styles.exploreRow}
            onPress={()=>{setFeedTab("For You");setPage("Home");}}
          >
            <View style={[styles.exploreThumb,{backgroundColor:reel.background||C.card2}]}>
              <Text style={{fontSize:30}}>{reel.videoUrl?"▶":reel.emoji||"🎬"}</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={styles.creatorName}>@{reel.creator}</Text>
              <Text style={styles.smallMuted} numberOfLines={2}>{reel.caption}</Text>
              <Text style={styles.exploreMusic}>♫ {reel.music||"Original Sound"}</Text>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  function renderInbox() {
    return (
      <View style={styles.centerPage}>
        <Text style={{fontSize:48}}>💬</Text>
        <Text style={styles.pageTitle}>Inbox</Text>
        <Text style={styles.emptyText}>Your messages and notifications will appear here.</Text>
        <Text style={styles.smallMuted}>Messaging feature will be connected in a future update.</Text>
      </View>
    );
  }

  function renderCreate() {
    const pageTitle={camera:"Create",gallery:"Choose Media",selected:"Preview",editor:"Video Editor",post:"Post Settings",privacy:"Who can watch?",more:"More Options",publish:"Publish"}[createStep]||"Create";
    const goBack=()=>{
      const prev={gallery:"camera",selected:"gallery",editor:"selected",post:"editor",privacy:"post",more:"post",publish:"post"}[createStep];
      if(prev) setCreateStep(prev); else setPage("Home");
    };
    const action=(label,onPress,secondary=false)=> <Button title={label} onPress={onPress} secondary={secondary} />;
    const toggleRow=(label,value,setter)=> (
      <TouchableOpacity style={styles.selectedBox} onPress={()=>setter(!value)}>
        <Text style={styles.selectedTitle}>{value?"✓":"○"}  {label}</Text>
      </TouchableOpacity>
    );
    return (
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <TouchableOpacity onPress={goBack}><Text style={{color:C.magenta,fontSize:16,fontWeight:"800"}}>‹ Back</Text></TouchableOpacity>
          <Text style={styles.pageTitle}>{pageTitle}</Text>
          <Text style={{color:C.gray,fontSize:12}}>{({camera:"1/8",gallery:"2/8",selected:"3/8",editor:"4/8",post:"5/8",privacy:"6/8",more:"7/8",publish:"8/8"})[createStep]}</Text>
        </View>

        {createStep==="camera" && <>
          <Text style={styles.pageSubtitle}>Record a video or choose media from your phone</Text>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🎥 Create a video</Text>
            <Button title="📷 Open Camera" onPress={async()=>{await recordVideo();}} />
            <Button title="🖼️ Choose from Gallery" secondary onPress={()=>setCreateStep("gallery")} />
            <Button title="♫ Add Sound" secondary onPress={()=>{setSoundReturnPage("Create");setPage("Sound");}} />
            <Text style={styles.helpText}>Camera se video record karein ya gallery se video select karein.</Text>
          </View>
        </>}

        {createStep==="gallery" && <>
          <Text style={styles.pageSubtitle}>Apne phone se videos aur photos select karein</Text>
          <View style={styles.buttonRow}>
            {["All","Videos","Photos","AI Gallery"].map(tab=>(
              <TouchableOpacity key={tab} onPress={()=>setGalleryTab(tab)} style={[styles.galleryTab,galleryTab===tab&&styles.galleryTabActive]}>
                <Text style={[styles.galleryTabText,galleryTab===tab&&styles.galleryTabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.card}>
            {galleryTab==="All"&&<>
              <Text style={styles.sectionTitle}>All Media</Text>
              <Button title="＋ Open Phone Gallery" onPress={chooseAllMediaForPost}/>
              <Text style={styles.helpText}>Gallery se multiple videos/photos select kar sakte hain. Upload ke liye pehli selected video use hogi.</Text>
            </>}
            {galleryTab==="Videos"&&<>
              <Text style={styles.sectionTitle}>Videos</Text>
              <Button title="🎬 Select Video" onPress={chooseVideoFromGallery}/>
            </>}
            {galleryTab==="Photos"&&<>
              <Text style={styles.sectionTitle}>Photos</Text>
              <Button title="🖼️ Select Photos (up to 10)" onPress={choosePhotosForPost}/>
            </>}
            {galleryTab==="AI Gallery"&&<>
              <Text style={styles.sectionTitle}>AI Gallery</Text>
              <Text style={styles.helpText}>AI Gallery abhi connected nahi hai. AI se banayi hui image/video ko phone mein save karke All, Videos ya Photos se select karein.</Text>
            </>}
            {!!selectedVideo&&<Text style={styles.selectedTitle}>✓ Video: {selectedVideo.fileName||"Selected video"}</Text>}
            {!!createPhotos.length&&<Text style={styles.selectedTitle}>✓ {createPhotos.length} photo(s) selected</Text>}
            {createPhotos.length>0&&<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:12}}>{createPhotos.map((photo,index)=><Image key={`${photo.uri}-${index}`} source={{uri:photo.uri}} style={{width:76,height:76,borderRadius:10,marginRight:8}}/>)}</ScrollView>}
            {action("Next",()=>{if(!selectedVideo?.uri)return Alert.alert("Video required","Upload ke liye pehle Videos ya All se video select karein.");setCreateStep("selected");},false)}
          </View>
        </>}

        {createStep==="selected" && <>
          <Text style={styles.pageSubtitle}>Check your selected video before editing</Text>
          <View style={styles.card}>
            {selectedVideo?.uri?<><Video source={{uri:selectedVideo.uri}} style={{width:"100%",height:360,backgroundColor:"#000",borderRadius:14}} useNativeControls resizeMode={ResizeMode.CONTAIN}/><Text style={styles.smallMuted}>{selectedVideo.fileName||"Selected video"}</Text></>:<Text style={styles.helpText}>Abhi video select nahi hui.</Text>}
            {action("Choose / Change Video",()=>setCreateStep("gallery"),true)}
            {action("⚡ AutoCut",()=>Alert.alert("AutoCut","AutoCut processing is not connected in this Expo Snack build. A native video-processing engine is required."),true)}
            {action("Next: Edit Video",()=>{if(!selectedVideo?.uri)return Alert.alert("Video required","Pehle video select karein.");setCreateStep("editor");})}
          </View>
        </>}

        {createStep==="editor" && <>
          <Text style={styles.pageSubtitle}>Preview and prepare your video</Text>
          <View style={styles.card}>
            {selectedVideo?.uri&&<Video source={{uri:selectedVideo.uri}} style={{width:"100%",height:340,backgroundColor:"#000",borderRadius:14}} useNativeControls resizeMode={ResizeMode.CONTAIN}/>}
            <Text style={styles.sectionTitle}>Editing tools</Text>
            <View style={styles.buttonRow}><Button title="✂️ Trim" secondary onPress={()=>Alert.alert("Trim","Video trimming ke liye alag video-editing package setup karna hoga.")}/><Button title="✨ Filters" secondary onPress={()=>Alert.alert("Filters","Rendered filters ke liye video editor package setup karna hoga.")}/></View>
            <View style={styles.buttonRow}><Button title="📝 Text" secondary onPress={()=>Alert.alert("Text overlay","Video par text render karne ke liye video editor package setup karna hoga.")}/><Button title="🖼️ Add Photos" secondary onPress={choosePhotosForPost}/></View>
            <Button title="♫ Add Sound" secondary onPress={()=>{setSoundReturnPage("Create");setPage("Sound");}}/>
            <Button title="Your Story" secondary onPress={()=>Alert.alert("Your Story","Story publishing is not connected yet. Your selected video can still be published as a regular post.")}/>
            <Text style={styles.helpText}>Note: Is build mein video preview aur sound selection kaam karte hain. Trim, filters aur photo/text overlays abhi actual video file mein render nahi hote; unke liye extra editor package setup hoga.</Text>
            {action("Next: Post Settings",()=>setCreateStep("post"))}
          </View>
        </>}

        {createStep==="post" && <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput style={[styles.input,styles.captionInput]} placeholder="Write a caption..." placeholderTextColor={C.gray} multiline value={caption} onChangeText={setCaption}/>
            <Text style={styles.fieldLabel}>Cover</Text>
            <Button title="Choose cover from Gallery" secondary onPress={choosePostCoverImage}/>
            {postCoverImage&&<Image source={{uri:postCoverImage}} style={{width:"100%",height:150,borderRadius:12,marginTop:8}}/>}
            <Text style={styles.fieldLabel}>Hashtags</Text>
            <TextInput style={styles.input} placeholder="#trending #viral" placeholderTextColor={C.gray} value={postHashtags} onChangeText={setPostHashtags}/>
            <Text style={styles.fieldLabel}>Mention</Text>
            <TextInput style={styles.input} placeholder="@username" placeholderTextColor={C.gray} value={postMention} onChangeText={setPostMention}/>
            <Text style={styles.fieldLabel}>Location</Text>
            <TextInput style={styles.input} placeholder="Add location" placeholderTextColor={C.gray} value={postLocation} onChangeText={setPostLocation}/>
            <Text style={styles.fieldLabel}>Add link</Text>
            <TextInput style={styles.input} placeholder="https://..." placeholderTextColor={C.gray} value={postLink} onChangeText={setPostLink} autoCapitalize="none"/>
            <Text style={styles.fieldLabel}>Audience</Text>
            <TouchableOpacity style={styles.selectedBox} onPress={()=>setCreateStep("privacy")}><Text style={styles.selectedTitle}>{privacy}  › Change audience</Text></TouchableOpacity>
            <View style={styles.buttonRow}><Button title="More Options" secondary onPress={()=>setCreateStep("more")} style={{flex:1}}/><Button title={`Drafts (${drafts.length})`} secondary onPress={openDrafts} style={{flex:1}}/></View>
            <Button title="Next: Publish" onPress={()=>setCreateStep("publish")}/>
          </View>
        </>}

        {createStep==="privacy" && <View style={styles.card}>
          <Text style={styles.sectionTitle}>Who can watch this video?</Text>
          {["Public","Friends","Only You","Private"].map(v=><TouchableOpacity key={v} style={styles.selectedBox} onPress={()=>{setPrivacy(v==="Only You"?"Private":v);setCreateStep("post");}}><Text style={styles.selectedTitle}>{privacy===v||(v==="Only You"&&privacy==="Private")?"🔘":"◯"}  {v}</Text></TouchableOpacity>)}
        </View>}

        {createStep==="more" && <View style={styles.card}>
          <Text style={styles.sectionTitle}>More Options</Text>
          {toggleRow("Allow comments",allowComments,setAllowComments)}
          {toggleRow("Allow reuse / remix",allowReuse,setAllowReuse)}
          <Text style={styles.fieldLabel}>Video language</Text>
          <View style={styles.buttonRow}>{["English","Urdu","Other"].map(v=><Button key={v} title={v} secondary={videoLanguage!==v} onPress={()=>setVideoLanguage(v)} style={{flex:1}}/>)}</View>
          {toggleRow("AI-generated content",aiGenerated,setAiGenerated)}
          <Button title="Save Options" onPress={()=>setCreateStep("post")}/>
        </View>}

        {createStep==="publish" && <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ready to share?</Text>
          {selectedVideo?.uri&&<Video source={{uri:selectedVideo.uri}} style={{width:"100%",height:300,backgroundColor:"#000",borderRadius:14}} useNativeControls resizeMode={ResizeMode.CONTAIN}/>}
          <Text style={styles.helpText}>Audience: {privacy}  •  Sound: {selectedSound||"Original Sound"}</Text>
          <Button title={uploading?"Uploading...":"🚀 Publish Video"} onPress={uploadVideoPost} disabled={uploading}/>
          <Button title="Save as Draft" secondary onPress={saveCurrentDraft}/>
          {uploading&&<View style={styles.uploadProgressBox}><View style={styles.uploadProgressHeader}><Text style={styles.uploadProgressTitle}>{uploadStage}</Text><Text style={styles.uploadPercent}>{uploadProgress}%</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${uploadProgress}%`}]}/></View><ActivityIndicator color={C.magenta} style={{marginTop:12}}/><Text style={styles.uploadHint}>Upload ke dauran app band na karein.</Text></View>}
        </View>}
      </ScrollView>
    );
  }

    function renderProfile() {
    const profileVideos=profileTab==="Videos"
      ?myPublicPosts
      :profileTab==="Private"
        ?privatePosts
        :allReels.filter(post=>!!liked[post.id] && isRealVideoPost(post));

    return (
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.profilePageContent}>
        <View style={styles.profileTopBar}>
          <TouchableOpacity onPress={()=>setPage("Home")}><Text style={styles.profileTopIcon}>‹</Text></TouchableOpacity>
          <Text style={styles.profileTopUsername}>@{username}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open Settings" style={styles.gearButton} onPress={()=>setPage("Settings")}><Text style={{fontSize:27,color:C.white}}>☰</Text></TouchableOpacity>
        </View>

        <View style={styles.profileCoverWrap}>
          {coverImage ? (
            <Image source={{uri:coverImage}} style={styles.profileCoverImage}/>
          ) : (
            <View style={styles.profileCoverPlaceholder}/>
          )}
        </View>

        <View style={styles.profileMain}>
          <View style={styles.profileAvatarBig}>
            {profileImage ? (
              <Image source={{uri:profileImage}} style={styles.profileAvatarImage}/>
            ) : (
              <Text style={{fontSize:42}}>👤</Text>
            )}
          </View>
          <Text style={styles.profileName}>@{username}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          {location ? <Text style={styles.profileLocation}>📍 {location}</Text> : null}
          <Text style={styles.profileBio}>{bio}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statNumber}>{myPosts.length}</Text><Text style={styles.statLabel}>Posts</Text></View>
            <View style={styles.statDivider}/>
            <View style={styles.stat}><Text style={styles.statNumber}>{followerCount}</Text><Text style={styles.statLabel}>Followers</Text></View>
            <View style={styles.statDivider}/>
            <View style={styles.stat}><Text style={styles.statNumber}>{Object.keys(following).length}</Text><Text style={styles.statLabel}>Following</Text></View>
            <View style={styles.statDivider}/>
            <View style={styles.stat}><Text style={styles.statNumber}>{Object.values(liked).filter(Boolean).length}</Text><Text style={styles.statLabel}>Likes</Text></View>
          </View>

          <View style={styles.profileButtons}>
            <TouchableOpacity
              style={styles.profileActionButton}
              onPress={()=>{
                setEditUsername(username);
                setEditBio(bio);
                setEditLocation(location);
                setEditProfileImage(profileImage);
                setEditCoverImage(coverImage);
                setPage("EditProfile");
              }}
            >
              <Text style={styles.profileActionText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileActionButton} onPress={()=>Share.share({message:`Check out @${username} on Gen Video Live!`})}>
              <Text style={styles.profileActionText}>Share Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileTabBar}>
          {["Videos","Liked","Private"].map(tab=>(
            <TouchableOpacity
              key={tab}
              style={styles.profileTab}
              onPress={()=>setProfileTab(tab)}
            >
              <Text style={[styles.profileTabText,profileTab===tab&&styles.profileTabActive]}>
                {tab==="Videos"?"▦ Videos":tab==="Liked"?"♡ Liked":"🔒 Private"}
              </Text>
              {profileTab===tab&&<View style={styles.profileTabUnderline}/>}
            </TouchableOpacity>
          ))}
        </View>

        {profileVideos.length>0?(
          <View style={styles.videoGrid}>
            {profileVideos.map(item=>(
              <TouchableOpacity
                key={item.id}
                style={styles.videoGridItem}
                onPress={()=>{
                  if(item.videoUrl) setPlayingPost(item);
                  else Alert.alert("Sample Reel","Yeh demo video player se nahi chalegi.");
                }}
              >
                <View style={styles.videoGridPlaceholder}>
                  {getVideoThumbnail(item) ? (
                    <Image source={{uri:getVideoThumbnail(item)}} style={styles.videoGridThumbnail}/>
                  ) : (
                    <View style={styles.videoGridNoThumbnail}/>
                  )}
                  <View style={styles.videoGridOverlay}>
                    <Text style={styles.videoGridPlay}>▶</Text>
                    <Text style={styles.videoGridCaption} numberOfLines={2}>{item.caption||""}</Text>
                    <Text style={styles.videoGridViews}>
                      {profileTab==="Liked"?"❤️ Liked":item.privacy==="Private"?"🔒 Private":"♫ Public"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ):(
          <View style={styles.emptyProfileVideos}>
            <Text style={{fontSize:42}}>
              {profileTab==="Private"?"🔒":profileTab==="Liked"?"❤️":"🎬"}
            </Text>
            <Text style={styles.emptyProfileTitle}>
              {profileTab==="Videos"?"No videos yet":profileTab==="Liked"?"No liked videos":"No private videos"}
            </Text>
            <Text style={styles.smallMuted}>
              {profileTab==="Liked"?"Videos you like will appear here.":"Your uploaded videos will appear here."}
            </Text>
            {profileTab==="Videos"&&<Button title="＋ Create Video" onPress={()=>setPage("Create")}/>}
          </View>
        )}
      </ScrollView>
    );
  }

  function renderVideoPlayer() {
    if(!playingPost) return null;

    return (
      <View style={styles.playerScreen}>
        <TouchableOpacity onPress={()=>setPlayingPost(null)} style={styles.playerBack}>
          <Text style={styles.backText}>‹ Back to Profile</Text>
        </TouchableOpacity>
        <Video
          source={{uri:playingPost.videoUrl}}
          style={styles.fullVideo}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping
        />
        <Text style={styles.playerCaption}>{playingPost.caption}</Text>
      </View>
    );
  }

  function renderEditProfile() {
    return (
      <KeyboardAvoidingView style={styles.pageScroll} behavior={Platform.OS==="ios"?"padding":undefined}>
        <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={()=>setPage("Profile")}><Text style={styles.backText}>‹ Back</Text></TouchableOpacity>
          <Text style={styles.pageTitle}>Edit Profile</Text>

          <Text style={styles.fieldLabel}>Cover Image</Text>
          <TouchableOpacity style={styles.editCoverPreview} onPress={chooseCoverImage}>
            {editCoverImage ? (
              <Image source={{uri:editCoverImage}} style={styles.editCoverImage}/>
            ) : (
              <Text style={styles.imagePickerText}>＋ Choose Cover Image</Text>
            )}
          </TouchableOpacity>
          <Button title="Change Cover Image" secondary onPress={chooseCoverImage}/>

          <Text style={styles.fieldLabel}>Profile Image</Text>
          <TouchableOpacity style={styles.editAvatarPreview} onPress={chooseProfileImage}>
            {editProfileImage ? (
              <Image source={{uri:editProfileImage}} style={styles.editAvatarImage}/>
            ) : (
              <Text style={{fontSize:38}}>👤</Text>
            )}
          </TouchableOpacity>
          <Button title="Change Profile Image" secondary onPress={chooseProfileImage}/>

          <Text style={styles.fieldLabel}>Username</Text>
          <TextInput style={styles.input} value={editUsername} onChangeText={setEditUsername} placeholder="Your username" placeholderTextColor={C.gray} autoCapitalize="none"/>

          <Text style={styles.fieldLabel}>Bio</Text>
          <TextInput style={[styles.input,{height:100,textAlignVertical:"top"}]} value={editBio} onChangeText={setEditBio} multiline placeholder="Your bio" placeholderTextColor={C.gray}/>

          <Text style={styles.fieldLabel}>Location</Text>
          <TextInput style={styles.input} value={editLocation} onChangeText={setEditLocation} placeholder="Your location" placeholderTextColor={C.gray}/>

          <Button title={loading?"Saving...":"Save Profile"} onPress={saveProfile} disabled={loading}/>
          {loading&&<ActivityIndicator color={C.magenta} style={{marginTop:12}}/>}
          <Button title="Cancel" secondary onPress={()=>setPage("Profile")}/>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  function renderSound() {
    const soundReels=allReels.filter(reel=>(reel.music||"Original Sound")===soundTitle);

    return (
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent}>
        <TouchableOpacity onPress={()=>setPage(soundReturnPage)}><Text style={styles.backText}>‹ Back</Text></TouchableOpacity>
        <View style={styles.soundHero}>
          <SpinningDisc avatarUrl={soundAvatarUrl}/>
          <Text style={styles.soundTitle}>{soundTitle}</Text>
          <View style={styles.soundCreatorRow}>
            {soundAvatarUrl ? (
              <Image source={{uri:soundAvatarUrl}} style={styles.soundCreatorAvatar}/>
            ) : null}
            <Text style={styles.soundCreator}>Original sound • @{soundCreator}</Text>
          </View>
          <Button title="＋ Use This Sound" onPress={()=>{setSelectedSound(soundTitle);setPage(soundReturnPage);}}/>
          <Button title="↗ Share Sound" secondary onPress={()=>Share.share({message:`${soundTitle} on Gen Video Live`})}/>
        </View>
        <Text style={styles.sectionTitle}>Videos using this sound</Text>
        {soundReels.length>0?soundReels.map(reel=>(
          <View key={reel.id} style={styles.soundVideoRow}>
            <Text style={{fontSize:28}}>{reel.videoUrl?"▶":reel.emoji||"🎬"}</Text>
            <View style={{flex:1}}>
              <Text style={styles.creatorName}>@{reel.creator}</Text>
              <Text style={styles.smallMuted}>{reel.caption}</Text>
            </View>
          </View>
        )):<Text style={styles.smallMuted}>Is sound ke saath videos yahan show hongi.</Text>}
      </ScrollView>
    );
  }

  function renderSettings() {
    return (
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent}>
        <TouchableOpacity onPress={()=>setPage("Profile")}><Text style={styles.backText}>‹ Back to Profile</Text></TouchableOpacity>
        <Text style={styles.pageTitle}>Settings</Text>

        <View style={styles.accountCard}>
          <View style={styles.settingsAvatar}><Text style={{fontSize:28}}>👤</Text></View>
          <View style={{flex:1}}>
            <Text style={styles.accountName}>{username}</Text>
            <Text style={styles.accountEmail}>{user?.email}</Text>
          </View>
        </View>

        {[
          ["🔔","Notifications"],
          ["🔐","Privacy & Security"],
          ["🚫","Blocked Users"],
          ["🌙","Appearance / Dark Mode"],
          ["🌐","Language: Urdu / English"],
          ["📦","Data & Storage"],
          ["❓","Help & Support"]
        ].map(item=>(
          <TouchableOpacity key={item[1]} style={styles.settingRow} onPress={()=>showPlaceholder(item[1])}>
            <Text style={styles.settingIcon}>{item[0]}</Text>
            <Text style={styles.settingTitle}>{item[1]}</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>🚪 Log Out</Text>
        </TouchableOpacity>
        <Text style={styles.smallMuted}>Gen Video Live • Version 1.0</Text>
      </ScrollView>
    );
  }

  if(!user) return renderLogin();

  if(playingPost) return (
    <View style={styles.app}>
      <StatusBar backgroundColor={C.bg} barStyle="light-content"/>
      {renderVideoPlayer()}
    </View>
  );

  return (
    <View style={styles.app}>
      <StatusBar backgroundColor={C.bg} barStyle="light-content"/>

      {page==="Home"&&renderHome()}
      {page==="Explore"&&renderExplore()}
      {page==="Inbox"&&renderInbox()}
      {page==="Create"&&renderCreate()}
      {page==="Profile"&&renderProfile()}
      {page==="EditProfile"&&renderEditProfile()}
      {page==="Sound"&&renderSound()}
      {page==="Settings"&&renderSettings()}

      {page!=="EditProfile"&&page!=="Sound"&&page!=="Settings"&&(
        <View style={styles.bottomNav}>
          <NavItem icon="⌂" label="Home" active={page==="Home"} onPress={()=>setPage("Home")}/>
          <NavItem icon="⌕" label="Explore" active={page==="Explore"} onPress={()=>setPage("Explore")}/>
          <NavItem icon="＋" label="Create+" active={page==="Create"} onPress={()=>setPage("Create")}/>
          <NavItem icon="✉" label="Inbox" active={page==="Inbox"} onPress={()=>setPage("Inbox")}/>
          <NavItem
            icon="👤"
            label="Profile"
            active={page==="Profile"}
            onPress={()=>{
              setPage("Profile");
              loadMyProfile();
              loadPosts();
              loadLikeSave();
            }}
          />
        </View>
      )}
    </View>
  );
}

// STYLES
const styles=StyleSheet.create({
  app:{flex:1,backgroundColor:C.bg},
  screen:{flex:1,backgroundColor:C.bg},
  authScreen:{flex:1,backgroundColor:C.bg},
  authContent:{flexGrow:1,justifyContent:"center",padding:22},
  crown:{fontSize:54,textAlign:"center",marginBottom:8},
  authTitle:{color:C.white,fontSize:30,fontWeight:"900",textAlign:"center"},
  authSubtitle:{color:C.magenta,textAlign:"center",marginTop:7,marginBottom:28},
  authCard:{backgroundColor:C.card,borderRadius:22,padding:20,borderWidth:1,borderColor:"#39334d"},
  sectionTitle:{color:C.white,fontSize:18,fontWeight:"800",marginBottom:14},
  input:{backgroundColor:"#121220",color:C.white,borderRadius:12,borderWidth:1,borderColor:"#37334a",paddingHorizontal:14,paddingVertical:13,marginBottom:13,fontSize:15},
  button:{backgroundColor:C.pink,borderRadius:13,paddingVertical:14,paddingHorizontal:16,alignItems:"center",justifyContent:"center",marginTop:10},
  secondaryButton:{backgroundColor:C.card2,borderWidth:1,borderColor:"#51435f"},
  buttonText:{color:C.white,fontWeight:"800",fontSize:15},
  switchText:{color:C.magenta,textAlign:"center",fontWeight:"700"},
  smallMuted:{color:C.gray,fontSize:12,marginTop:5},
  header:{height:62,paddingHorizontal:10,backgroundColor:C.bg,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:"#29283a"},
  logo:{color:C.white,fontSize:15,fontWeight:"900"},
  headerTabs:{flexDirection:"row",alignItems:"center",gap:12},
  headerTab:{color:C.gray,fontSize:12,fontWeight:"700",paddingVertical:10},
  headerTabActive:{color:C.white},
  tabUnderline:{height:3,backgroundColor:C.pink,borderRadius:3},
  liveButton:{backgroundColor:"#321b31",borderRadius:9,paddingHorizontal:8,paddingVertical:8},
  liveText:{color:C.magenta,fontWeight:"900",fontSize:10},
  reelScroll:{flex:1},
  reelPage:{width:"100%",position:"relative",justifyContent:"center",overflow:"hidden"},
  reelVideo:{width:"100%",height:"100%",backgroundColor:"#000"},
  reelCenter:{flex:1,alignItems:"center",justifyContent:"center"},
  reelEmoji:{fontSize:100},
  demoLabel:{color:"rgba(255,255,255,0.78)",fontSize:13,fontWeight:"700",marginTop:10},
  reelBottom:{position:"absolute",left:15,right:88,bottom:25},
  creatorName:{color:C.white,fontSize:15,fontWeight:"900"},
  caption:{color:C.white,fontSize:13,lineHeight:19,marginTop:8,marginBottom:11},
  audioLine:{flexDirection:"row",alignItems:"center",backgroundColor:"rgba(0,0,0,0.5)",alignSelf:"flex-start",paddingHorizontal:10,paddingVertical:7,borderRadius:20},
  musicNote:{color:C.magenta,fontSize:17,marginRight:7},
  music:{color:C.white,fontSize:12,fontWeight:"700",maxWidth:160},
  audioArrow:{color:C.white,marginLeft:8,fontSize:18},
  actionStack:{position:"absolute",right:10,bottom:20,alignItems:"center",gap:14},
  creatorFollow:{alignItems:"center",marginBottom:2},
  creatorAvatarRing:{width:55,height:55,borderRadius:28,borderWidth:3,borderColor:C.gold,padding:2,backgroundColor:"#151522",alignItems:"center",justifyContent:"center",overflow:"hidden"},
  creatorAvatarImage:{width:"100%",height:"100%",borderRadius:25},
  creatorAvatarFallback:{width:"100%",height:"100%",borderRadius:25,backgroundColor:"#39334d",alignItems:"center",justifyContent:"center"},
  avatarEmoji:{fontSize:27},
  followPlus:{width:25,height:25,borderRadius:13,backgroundColor:C.pink,alignItems:"center",justifyContent:"center",marginTop:-10,borderWidth:2,borderColor:C.bg,zIndex:2},
  followedButton:{backgroundColor:"#292638"},
  followPlusText:{color:C.white,fontSize:19,fontWeight:"900",lineHeight:22},
  actionButton:{alignItems:"center",minWidth:47},
  actionIcon:{fontSize:25,color:C.white},
  actionCount:{color:C.white,fontSize:10,fontWeight:"800",marginTop:3},
  discButton:{marginTop:3,marginBottom:7},
  disc:{width:49,height:49,borderRadius:25,backgroundColor:"#15151d",borderWidth:5,borderColor:"#393944",alignItems:"center",justifyContent:"center"},
  discCenter:{width:18,height:18,borderRadius:9,backgroundColor:C.magenta,alignItems:"center",justifyContent:"center",overflow:"hidden"},
  discAvatar:{width:18,height:18,borderRadius:9},
  emptyFeed:{alignItems:"center",justifyContent:"center",padding:25,backgroundColor:C.bg},
  emptyText:{color:C.gray,textAlign:"center",marginTop:15,fontSize:14},
  bottomNav:{height:66,backgroundColor:"#151522",borderTopWidth:1,borderTopColor:"#2b293b",flexDirection:"row",justifyContent:"space-around",alignItems:"center",paddingHorizontal:2},
  navItem:{alignItems:"center",justifyContent:"center",flex:1},
  navIcon:{fontSize:22,fontWeight:"800"},
  navLabel:{fontSize:9,marginTop:2,fontWeight:"700"},
  pageScroll:{flex:1,backgroundColor:C.bg},
  pageContent:{padding:16,paddingBottom:35},
  pageTitle:{color:C.white,fontSize:26,fontWeight:"900",marginBottom:7},
  pageSubtitle:{color:C.gray,marginBottom:18},
  card:{backgroundColor:C.card,borderRadius:18,padding:16,marginTop:14,borderWidth:1,borderColor:"#302d43"},
  buttonRow:{flexDirection:"row",gap:10,alignItems:"center"},
  galleryTab:{flex:1,paddingVertical:11,paddingHorizontal:5,borderRadius:10,backgroundColor:C.card2,alignItems:"center",borderWidth:1,borderColor:"#39334d"},
  galleryTabActive:{backgroundColor:"#48223f",borderColor:C.magenta},
  galleryTabText:{color:C.gray,fontSize:11,fontWeight:"700"},
  galleryTabTextActive:{color:C.white},
  selectedBox:{backgroundColor:"#172c2a",borderRadius:12,padding:12,marginTop:13},
  selectedTitle:{color:C.green,fontWeight:"800"},
  helpText:{color:C.gray,fontSize:12,lineHeight:18,marginTop:12},
  captionInput:{minHeight:90,textAlignVertical:"top"},
  soundSelect:{backgroundColor:"#121220",borderRadius:12,padding:14,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  soundSelectText:{color:C.white,fontWeight:"700"},
  fieldLabel:{color:C.gray,fontSize:13,fontWeight:"700",marginBottom:8,marginTop:15},
  uploadProgressBox:{backgroundColor:"#171729",borderRadius:13,padding:14,marginTop:15,borderWidth:1,borderColor:"#59304f"},
  uploadProgressHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12},
  uploadProgressTitle:{color:C.white,fontSize:12,fontWeight:"700",flex:1,marginRight:8},
  uploadPercent:{color:C.magenta,fontSize:17,fontWeight:"900"},
  progressTrack:{height:9,backgroundColor:"#39334d",borderRadius:10,overflow:"hidden"},
  progressFill:{height:9,backgroundColor:C.magenta,borderRadius:10},
  uploadHint:{color:C.gray,fontSize:11,textAlign:"center",marginTop:8},
  profilePageContent:{paddingBottom:22},
  profileTopBar:{height:52,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:15},
  profileTopIcon:{color:C.white,fontSize:30,width:35},
  profileTopUsername:{color:C.white,fontWeight:"900",fontSize:17},
  gearButton:{width:48,height:48,borderRadius:24,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},
  profileCoverWrap:{height:155,width:"100%",backgroundColor:C.card2,overflow:"hidden"},
  profileCoverImage:{width:"100%",height:"100%",resizeMode:"cover"},
  profileCoverPlaceholder:{flex:1,backgroundColor:"#25253a"},
  profileMain:{alignItems:"center",paddingHorizontal:15,paddingTop:8},
  profileAvatarBig:{width:104,height:104,borderRadius:52,backgroundColor:C.card2,borderWidth:2,borderColor:C.magenta,alignItems:"center",justifyContent:"center",overflow:"hidden",marginTop:-48},
  profileAvatarImage:{width:"100%",height:"100%",resizeMode:"cover"},
  profileName:{color:C.white,fontSize:20,fontWeight:"900",marginTop:10},
  profileEmail:{color:"#77778e",fontSize:11,marginTop:5},
  profileLocation:{color:C.gray,fontSize:12,marginTop:7},
  profileBio:{color:C.gray,textAlign:"center",marginTop:8,lineHeight:19,paddingHorizontal:15},
  statsRow:{flexDirection:"row",justifyContent:"space-around",alignItems:"center",width:"100%",backgroundColor:C.card,borderRadius:15,paddingVertical:15,marginTop:18},
  stat:{alignItems:"center",flex:1},
  statNumber:{color:C.white,fontSize:18,fontWeight:"900"},
  statLabel:{color:C.gray,fontSize:10,marginTop:4},
  statDivider:{height:27,width:1,backgroundColor:"#39364c"},
  profileButtons:{flexDirection:"row",width:"100%",gap:8,marginTop:14},
  profileActionButton:{flex:1,backgroundColor:C.card2,borderRadius:9,paddingVertical:11,alignItems:"center"},
  profileActionText:{color:C.white,fontSize:12,fontWeight:"800"},
  profileTabBar:{flexDirection:"row",borderBottomWidth:1,borderBottomColor:"#302d43",marginTop:20},
  profileTab:{flex:1,alignItems:"center",paddingVertical:12},
  profileTabText:{color:C.gray,fontSize:12,fontWeight:"700"},
  profileTabActive:{color:C.white},
  profileTabUnderline:{position:"absolute",bottom:0,height:3,width:"55%",backgroundColor:C.pink,borderRadius:3},
  videoGrid:{flexDirection:"row",flexWrap:"wrap"},
  videoGridItem:{width:"33.333%",height:155,padding:1},
  videoGridPlaceholder:{flex:1,backgroundColor:"#171725",alignItems:"center",justifyContent:"center",overflow:"hidden"},
  videoGridThumbnail:{...StyleSheet.absoluteFillObject,width:"100%",height:"100%",resizeMode:"cover"},
  videoGridNoThumbnail:{...StyleSheet.absoluteFillObject,backgroundColor:"#25253a"},
  videoGridOverlay:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(0,0,0,0.28)",alignItems:"center",justifyContent:"center",padding:5},
  videoGridPlay:{color:C.white,fontSize:27,textShadowColor:"#000",textShadowRadius:5},
  videoGridCaption:{color:C.white,fontSize:9,textAlign:"center",marginTop:5},
  videoGridViews:{color:C.magenta,fontSize:9,marginTop:4},
  emptyProfileVideos:{alignItems:"center",justifyContent:"center",padding:35,minHeight:220},
  emptyProfileTitle:{color:C.white,fontSize:17,fontWeight:"900",marginTop:12,marginBottom:5},
  backText:{color:C.magenta,fontSize:18,fontWeight:"800",marginBottom:15},
  editCoverPreview:{height:130,width:"100%",backgroundColor:C.card2,borderRadius:12,overflow:"hidden",alignItems:"center",justifyContent:"center"},
  editCoverImage:{width:"100%",height:"100%",resizeMode:"cover"},
  imagePickerText:{color:C.white,fontWeight:"700"},
  editAvatarPreview:{width:112,height:112,borderRadius:56,backgroundColor:C.card2,borderWidth:2,borderColor:C.magenta,alignItems:"center",justifyContent:"center",overflow:"hidden",alignSelf:"center"},
  editAvatarImage:{width:"100%",height:"100%",resizeMode:"cover"},
  soundHero:{backgroundColor:"#21172d",borderRadius:22,padding:23,alignItems:"center",marginVertical:18,borderWidth:1,borderColor:"#59304f"},
  soundTitle:{color:C.white,fontSize:22,fontWeight:"900",marginTop:20,textAlign:"center"},
  soundCreator:{color:C.gray,marginTop:6,marginBottom:12},
  soundCreatorRow:{flexDirection:"row",alignItems:"center",justifyContent:"center"},
  soundCreatorAvatar:{width:25,height:25,borderRadius:13,marginRight:7},
  soundVideoRow:{flexDirection:"row",alignItems:"center",backgroundColor:C.card,borderRadius:13,padding:12,marginTop:9,gap:12},
  exploreRow:{flexDirection:"row",alignItems:"center",backgroundColor:C.card,borderRadius:14,padding:10,marginTop:10,gap:12},
  exploreThumb:{width:65,height:75,borderRadius:10,alignItems:"center",justifyContent:"center"},
  exploreMusic:{color:C.magenta,fontSize:11,marginTop:5},
  settingRow:{flexDirection:"row",alignItems:"center",paddingVertical:15,borderBottomWidth:1,borderBottomColor:"#333044"},
  settingIcon:{fontSize:19,width:38},
  settingTitle:{color:C.white,flex:1,fontWeight:"700"},
  settingArrow:{color:C.gray,fontSize:23},
  logoutButton:{marginTop:22,backgroundColor:"#3a1c2b",borderRadius:12,padding:15,alignItems:"center"},
  logoutText:{color:"#ff6b87",fontSize:15,fontWeight:"900"},
  accountCard:{flexDirection:"row",alignItems:"center",backgroundColor:C.card,borderWidth:1,borderColor:"#49304e",borderRadius:17,padding:15,marginTop:15},
  settingsAvatar:{width:60,height:60,borderRadius:30,borderWidth:2,borderColor:C.pink,backgroundColor:C.card2,justifyContent:"center",alignItems:"center",marginRight:14},
  accountName:{color:C.white,fontSize:16,fontWeight:"bold"},
  accountEmail:{color:C.gray,fontSize:11,marginTop:5},
  centerPage:{flex:1,backgroundColor:C.bg,alignItems:"center",justifyContent:"center",padding:25},
  playerScreen:{flex:1,backgroundColor:"#000",paddingTop:10},
  playerBack:{padding:15},
  fullVideo:{width:"100%",height:"75%"},
  playerCaption:{color:C.white,padding:15,fontSize:14}
});
