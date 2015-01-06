<html>
<head>
<title>Check out my Wishlist!</title>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body bgcolor="#D60000" leftmargin="0" topmargin="0" marginwidth="0" marginheight="0">

<center>
<div style="width:570px; height: 1000px;background-color: #FFFFFF;">
	<!-- Masthead -->	
	<table width="530" border="0" cellpadding="0" cellspacing="0"style="padding: 10px 0px 10px 0px;">
		<tr>
			<td width="75" height="75"><img src="http://www.mywish.io/img/icon_512.png" width="75" height="75" alt=""></td>	
			<td style="padding-left: 10px;">
				<table>
					<tr>
						<td width="400" align="left" style="padding-left: 5px; font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial; font-weight: 400; font-size: 40px; color: black;">Wishlist</td>
					</tr>
					<tr>
						<td style="font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial; font-weight: 200; font-size: 20px; font-style: italic; color: black;">Create a wish and share it!</td>
					</tr>
				</table>
		</tr>
	</table>
	
	
	<!-- Content -->
	<table align="center" style="background-color: #FFF; width: 530px; min-height: 400px; padding-top:30px; text-align: left;">
		<tbody>
			<tr>	    
			    <td>
			  		<table>
			  			<tr>
			  				<td>
			  					{% if user.profilephoto %}
			  						<img style="width: 140px; height: auto; border-radius: 6px; display: inline-block" src="{{user.profilephoto.urls.thumb300x300}}">
			  					{% else %}
			  						<img style="width: 140px; height: auto; border-radius: 6px; display: inline-block" src="http://www.mywish.io/img/generic-profile.jpg">
			  					{% endif %}
			  					
			  				</td>

			  				<td cellpadding=10px>
			  				  	<h1 style="color:#6E6E6E;font-family:'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size:27px; font-weight: 400; margin-bottom: 15px; margin-left: 10px; display: inline-block;">{{user.profile.name}} shared with you!</h1>
				    		</td>
				    	</tr>
				    	<tr>
				    		<td></td>
				    		<td>
				    			<p style="color:#6E6E6E; font-family:'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size:16px; font-weight: 200; margin-bottom: 5px; margin-left: 10px; ">Get the app!
				    			</p>
				    			<table style="margin-left: 10px;" >
				    				<tr>
				    				<td><img style="display: inline-block;" src="http://www.mywish.io/img/ios_link.png"></td>
				    				<td><img style="display: inline-block;" src="http://www.mywish.io/img/android_link.png"></td>
				    				</tr>
				    			</table>
				    		</td>
				    </table>
				    
					<!-- List of Items -->
					<p style="color:#6E6E6E;font-family:'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size:24px; font-weight: 200; margin-top: 60px; margin-bottom: 15px; ">{{user.profile.name}}'s Stuff</p>

			    </td>
			</tr>
		</tbody>
	</table>
	
	

	<!-- /content -->
</div>
</center>
</body>
</html>